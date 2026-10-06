/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::{
	fs::{read_dir, read_to_string, remove_dir_all, write},
	path::PathBuf,
};

use serde::{Deserialize, Serialize};

use crate::{
	options::{self, Quality},
	state::LauncherPaths,
	util::{
		errors::{wrap, AnyError, WrappedError},
		machine,
	},
};
use crate::download_cache::validate_cache_entry_name;

pub const SERVER_FOLDER_NAME: &str = "server";

pub struct ServerPaths {
	// Directory into which the server is downloaded
	pub server_dir: PathBuf,
	// Executable path, within the server_id
	pub executable: PathBuf,
	// File where logs for the server should be written.
	pub logfile: PathBuf,
	// File where the process ID for the server should be written.
	pub pidfile: PathBuf,
}

impl ServerPaths {
	// Queries the system to determine the process ID of the running server.
	// Returns the process ID, if the server is running.
	pub fn get_running_pid(&self) -> Option<u32> {
		if let Some(pid) = self.read_pid() {
			return match machine::process_at_path_exists(pid, &self.executable) {
				true => Some(pid),
				false => None,
			};
		}

		if let Some(pid) = machine::find_running_process(&self.executable) {
			// attempt to backfill process ID:
			self.write_pid(pid).ok();
			return Some(pid);
		}

		None
	}

	/// Delete the server directory
	pub fn delete(&self) -> Result<(), WrappedError> {
		remove_dir_all(&self.server_dir).map_err(|e| {
			wrap(
				e,
				format!("error deleting server dir {}", self.server_dir.display()),
			)
		})
	}

	// VS Code Server pid
	pub fn write_pid(&self, pid: u32) -> Result<(), WrappedError> {
		write(&self.pidfile, format!("{pid}")).map_err(|e| {
			wrap(
				e,
				format!("error writing process id into {}", self.pidfile.display()),
			)
		})
	}

	fn read_pid(&self) -> Option<u32> {
		read_to_string(&self.pidfile)
			.ok()
			.and_then(|s| s.parse::<u32>().ok())
	}
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct InstalledServer {
	pub quality: options::Quality,
	pub commit: String,
	pub headless: bool,
}

impl InstalledServer {
	/// Gets path information about where a specific server should be stored.
	pub fn server_paths(&self, p: &LauncherPaths) -> Result<ServerPaths, WrappedError> {
		let server_dir = self.get_install_folder(p)?;
		Ok(ServerPaths {
			// allow using the OSS server in development via an override
			executable: if let Some(p) = option_env!("VSCODE_CLI_OVERRIDE_SERVER_PATH") {
				PathBuf::from(p)
			} else {
				server_dir
					.join(SERVER_FOLDER_NAME)
					.join("bin")
					.join(self.quality.server_entrypoint())
			},
			logfile: server_dir.join("log.txt"),
			pidfile: server_dir.join("pid.txt"),
			server_dir,
		})
	}

	fn get_install_folder(&self, p: &LauncherPaths) -> Result<PathBuf, WrappedError> {
		let name = if !self.headless {
			format!("{}-web", get_server_folder_name(self.quality, &self.commit))
		} else {
			get_server_folder_name(self.quality, &self.commit)
		};
		validate_cache_entry_name(&name)?;
		let cache_root = p.server_cache.path();
		let path = cache_root.join(&name);
		if !path.starts_with(cache_root) {
			return Err(wrap(
				"invalid cache entry name",
				format!("refusing server install folder outside cache root: {name}"),
			));
		}
		Ok(path)
	}
}

/// Prunes servers not currently running, and returns the deleted servers.
pub fn prune_stopped_servers(launcher_paths: &LauncherPaths) -> Result<Vec<ServerPaths>, AnyError> {
	get_all_servers(launcher_paths)
		.into_iter()
		.filter_map(|s| s.server_paths(launcher_paths).ok())
		.filter(|s| s.get_running_pid().is_none())
		.map(|s| s.delete().map(|_| s))
		.collect::<Result<_, _>>()
		.map_err(AnyError::from)
}

// Gets a list of all servers which look like they might be running.
pub fn get_all_servers(lp: &LauncherPaths) -> Vec<InstalledServer> {
	let mut servers: Vec<InstalledServer> = vec![];
	if let Ok(children) = read_dir(lp.server_cache.path()) {
		for child in children.flatten() {
			let fname = child.file_name();
			let fname = fname.to_string_lossy();
			let (quality, commit) = match fname.split_once('-') {
				Some(r) => r,
				None => continue,
			};

			let quality = match options::Quality::try_from(quality) {
				Ok(q) => q,
				Err(_) => continue,
			};

			servers.push(InstalledServer {
				quality,
				commit: commit.to_string(),
				headless: true,
			});
		}
	}

	servers
}

pub fn get_server_folder_name(quality: Quality, commit: &str) -> String {
	format!("{quality}-{commit}")
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::state::LauncherPaths;
	use crate::util::commit_hash::COMMIT_HASH_LEN;

	fn test_launcher_paths() -> LauncherPaths {
		let root = std::env::temp_dir().join(format!(
			"vscode-cli-paths-test-{}",
			std::process::id()
		));
		let _ = std::fs::create_dir_all(&root);
		LauncherPaths::new_without_replacements(root)
	}

	#[test]
	fn get_install_folder_rejects_bad_cache_names() {
		let paths = test_launcher_paths();
		let server = InstalledServer {
			quality: Quality::Stable,
			commit: "/tmp/evil".to_string(),
			headless: true,
		};
		assert!(server.server_paths(&paths).is_err());

		let server = InstalledServer {
			quality: Quality::Stable,
			commit: "../../../outside".to_string(),
			headless: true,
		};
		assert!(server.server_paths(&paths).is_err());
	}

	#[test]
	fn get_install_folder_accepts_quality_prefixed_commit() {
		let paths = test_launcher_paths();
		let cache_root = paths.server_cache.path();
		let commit = "a".repeat(COMMIT_HASH_LEN);
		let server = InstalledServer {
			quality: Quality::Stable,
			commit,
			headless: true,
		};
		let sp = server.server_paths(&paths).expect("valid folder name");
		assert!(sp.server_dir.starts_with(cache_root));
	}
}
