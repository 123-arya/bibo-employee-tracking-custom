//! Linux platform backend.
//!
//! Linux has no macOS-style TCC permission model, so the permission API reports
//! Granted. Idle time is read with xprintidle when available. Keyboard tapping is
//! currently a no-op; the function exists so the cross-platform tracker API builds.

use std::process::Command;

use crate::settings::Settings;
use super::{CapabilityRow, Permission, PermissionState};

pub fn capability_rows(s: &Settings) -> Vec<CapabilityRow> {
    let state = |enabled: bool| {
        if s.consented && enabled {
            PermissionState::Granted
        } else {
            PermissionState::Denied
        }
    };

    vec![
        CapabilityRow {
            key: "keystrokes".to_string(),
            label: "Activity & keystroke counts".to_string(),
            description: "Tracks the active app/window and counts keystrokes (counts only — never which keys are pressed).".to_string(),
            state: state(s.count_keystrokes),
            required: false,
            can_request: false,
            can_open_settings: false,
        },
        CapabilityRow {
            key: "screenshots".to_string(),
            label: "Screenshots".to_string(),
            description: "Captures periodic screenshots of your screen(s).".to_string(),
            state: state(s.capture_screenshots),
            required: false,
            can_request: false,
            can_open_settings: false,
        },
    ]
}

pub fn open_settings(_p: Permission) {}

pub fn permission_status(_p: Permission) -> PermissionState {
    PermissionState::Granted
}

pub fn request_screen_recording() -> bool {
    true
}

pub fn request_input_monitoring() -> bool {
    true
}

pub fn request_accessibility() -> bool {
    true
}

/// Linux keyboard counting is not implemented by this platform backend yet.
/// Returning false makes the existing tracker retry periodically without
/// pretending that key events are being captured.
pub fn run_keyboard_tap() -> bool {
    false
}

/// Seconds since the last keyboard/mouse input.
///
/// Requires the xprintidle package on X11. On Wayland or when the command is
/// unavailable, return 0 so the app remains usable instead of crashing.
pub fn idle_seconds() -> f64 {
    match Command::new("xprintidle").output() {
        Ok(output) if output.status.success() => String::from_utf8_lossy(&output.stdout)
            .trim()
            .parse::<u64>()
            .map(|ms| ms as f64 / 1000.0)
            .unwrap_or(0.0),
        _ => 0.0,
    }
}
