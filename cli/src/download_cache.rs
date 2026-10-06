/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::{
	fs::create_dir_all,
	path::{Component, Path, PathBuf},
};

use futures::Future;
use tokio::fs::remove_dir_all;

use crate::{
	state::PersistedState,
	util::errors::{wrap, AnyError, WrappedError},
};

const KEEP_LRU: usize = 5;
const STAGING_SUFFIX: &str = ".staging";
const RENAME_ATTEMPTS: u32 = 20;
const RENAME_DELAY: std::time::Duration = std::time::Duration::from_millis(200);
const PERSISTED_STATE_FILE_NAME: &str = "lru.json";

/// Rejects cache entry names that would escape the cache root or are otherwise unsafe
/// before any `join`, `remove_dir_all`, or `create_dir_all` on cache paths.
pub fn validate_cache_entry_name(name: &str) -> Result<(), WrappedError> {
	if name.is_empty() {
		return Err(wrap(
			"invalid cache entry name",
			"refusing empty download cache entry name".to_string(),
		));
	}
	if name.contains('/') || name.contains('\\') {
		return Err(wrap(
			"invalid cache entry name",
			format!("refusing download cache entry name with path separator: {name}"),
		));
	}
	let path = Path::new(name);
	if path.is_absolute() {
		return Err(wrap(
			"invalid cache entry name",
			format!("refusing absolute download cache entry name: {name}"),
		));
	}
	for component in path.components() {
		match component {
			Component::Normal(_) => {}
			Component::CurDir | Component::ParentDir | Component::Prefix(_) | Component::RootDir => {
				return Err(wrap(
					"invalid cache entry name",
					format!("refusing download cache entry name: {name}"),
				));
			}
		}
	}
	Ok(())
}

fn entry_path(cache_root: &Path, name: &str) -> Result<PathBuf, WrappedError> {
	validate_cache_entry_name(name)?;
	let joined = cache_root.join(name);
	if !joined.starts_with(cache_root) {
		return Err(wrap(
			"invalid cache entry name",
			format!("refusing download cache entry name outside cache root: {name}"),
		));
	}
	Ok(joined)
}

#[derive(Clone)]
pub struct DownloadCache {
	path: PathBuf,
	state: PersistedState<Vec<String>>,
}

impl DownloadCache {
	pub fn new(path: PathBuf) -> DownloadCache {
		DownloadCache {
			state: PersistedState::new(path.join(PERSISTED_STATE_FILE_NAME)),
			path,
		}
	}

	/// Gets the value stored on the state
	pub fn get(&self) -> Vec<String> {
		self.state.load()
	}

	/// Gets the download cache path. Names of cache entries can be formed by
	/// joining them to the path.
	pub fn path(&self) -> &Path {
		&self.path
	}

	/// Gets whether a cache exists with the name already. Marks it as recently
	/// used if it does exist.
	pub fn exists(&self, name: &str) -> Option<PathBuf> {
		let p = entry_path(self.path(), name).ok()?;
		if !p.exists() {
			return None;
		}

		let _ = self.touch(name.to_string());
		Some(p)
	}

	/// Removes the item from the cache, if it exists
	pub fn delete(&self, name: &str) -> Result<(), WrappedError> {
		let f = entry_path(self.path(), name)?;
		if f.exists() {
			std::fs::remove_dir_all(f).map_err(|e| wrap(e, "error removing cached folder"))?;
		}

		self.state.update(|l| {
			l.retain(|n| n != name);
		})
	}

	/// Calls the function to create the cached folder if it doesn't exist,
	/// returning the path where the folder is. Note that the path passed to
	/// the `do_create` method is a staging path and will not be the same as the
	/// final returned path.
	pub async fn create<F, T>(
		&self,
		name: impl AsRef<str>,
		do_create: F,
	) -> Result<PathBuf, AnyError>
	where
		F: FnOnce(PathBuf) -> T,
		T: Future<Output = Result<(), AnyError>> + Send,
	{
		let name = name.as_ref();
		let target_dir = entry_path(self.path(), name)?;
		if target_dir.exists() {
			return Ok(target_dir);
		}

		let temp_dir = entry_path(self.path(), &format!("{name}{STAGING_SUFFIX}"))?;
		let _ = remove_dir_all(&temp_dir).await; // cleanup any existing

		create_dir_all(&temp_dir).map_err(|e| wrap(e, "error creating server directory"))?;
		do_create(temp_dir.clone()).await?;

		let _ = self.touch(name.to_string());
		// retry the rename, it seems on WoA sometimes it takes a second for the
		// directory to be 'unlocked' after doing file/process operations in it.
		for attempt_no in 0..=RENAME_ATTEMPTS {
			match std::fs::rename(&temp_dir, &target_dir) {
				Ok(_) => {
					break;
				}
				Err(e) if attempt_no == RENAME_ATTEMPTS => {
					return Err(wrap(e, "error renaming downloaded server").into())
				}
				Err(_) => {
					tokio::time::sleep(RENAME_DELAY).await;
				}
			}
		}

		Ok(target_dir)
	}

	fn touch(&self, name: String) -> Result<(), AnyError> {
		validate_cache_entry_name(&name)?;

		self.state.update(|l| {
			if let Some(index) = l.iter().position(|s| s == &name) {
				l.remove(index);
			}
			l.insert(0, name);

			if l.len() <= KEEP_LRU {
				return;
			}

			if let Some(f) = l.last() {
				if let Ok(f) = entry_path(self.path(), f) {
					if !f.exists() || std::fs::remove_dir_all(f).is_ok() {
						l.pop();
					}
				}
			}
		})?;

		Ok(())
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::util::commit_hash::COMMIT_HASH_LEN;
	use std::fs;

	fn valid_commit_name(prefix: &str) -> String {
		let hex = "a".repeat(COMMIT_HASH_LEN);
		format!("{prefix}{hex}")
	}

	#[tokio::test]
	async fn create_rejects_escape_attempts_without_touching_outside_paths() {
		let tmp = tempfile::tempdir().unwrap();
		let parent = tmp.path().parent().unwrap();
		let outside = parent.join("outside");
		let outside_staging = parent.join("outside.staging");
		let cache = DownloadCache::new(tmp.path().to_path_buf());

		let evil_abs = if cfg!(unix) {
			"/tmp/evil".to_string()
		} else {
			"C:\\evil".to_string()
		};

		for bad in [
			"../outside",
			evil_abs.as_str(),
			"Stable-../../../outside",
			"Stable-/tmp/evil",
			"Stable-../outside",
			"Stable-../../outside",
		] {
			let err = cache
				.create(bad, |_| async { Ok(()) })
				.await
				.expect_err("expected cache create to fail for {bad}");
			assert!(
				err.to_string().contains("cache entry name") || err.to_string().contains("cache"),
				"unexpected error for {bad}: {err}"
			);
		}

		assert!(!outside.exists());
		assert!(!outside_staging.exists());
	}

	#[tokio::test]
	async fn create_accepts_stable_prefixed_commit_hash() {
		let tmp = tempfile::tempdir().unwrap();
		let cache = DownloadCache::new(tmp.path().to_path_buf());
		let name = valid_commit_name("Stable-");

		let created = cache
			.create(&name, |staging| {
				async move {
					fs::write(staging.join("marker"), b"ok").unwrap();
					Ok(())
				}
			})
			.await
			.expect("valid cache name should succeed");

		assert!(created.starts_with(tmp.path()));
		assert_eq!(fs::read(created.join("marker")).unwrap(), b"ok");
	}

	#[test]
	fn validate_cache_entry_name_rejects_bad_names() {
		assert!(validate_cache_entry_name("").is_err());
		assert!(validate_cache_entry_name("..").is_err());
		assert!(validate_cache_entry_name("../outside").is_err());
		assert!(validate_cache_entry_name("Stable-/tmp/x").is_err());
	}
}
