// Prevents extra console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tiny_rpg_studio_lib::run()
}
