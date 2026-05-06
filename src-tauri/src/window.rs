#[cfg(target_os = "windows")]
use std::mem::size_of;
#[cfg(target_os = "windows")]
use windows::Win32::{
    Foundation::{HWND, RECT},
    Graphics::{
        Dwm::{DwmGetWindowAttribute, DWMWA_EXTENDED_FRAME_BOUNDS},
        Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST},
    },
    UI::WindowsAndMessaging::{
        GetWindowRect, SetWindowPos, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOOWNERZORDER,
        SWP_NOZORDER,
    },
};

#[tauri::command]
pub fn fit_window_to_work_area(window: tauri::Window) -> Result<bool, String> {
    platform_fit_window_to_work_area(window)
}

#[cfg(target_os = "windows")]
fn platform_fit_window_to_work_area(window: tauri::Window) -> Result<bool, String> {
    let hwnd = window.hwnd().map_err(|error| error.to_string())?;

    unsafe {
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if monitor.is_invalid() {
            return Err("failed to resolve current monitor".to_string());
        }

        let mut monitor_info = MONITORINFO {
            cbSize: size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };

        if !GetMonitorInfoW(monitor, &mut monitor_info).as_bool() {
            return Err("failed to query monitor work area".to_string());
        }

        let outer_rect = window_rect(hwnd)?;
        let visible_rect = extended_frame_bounds(hwnd).unwrap_or(outer_rect);
        let frame = hidden_frame_insets(outer_rect, visible_rect);
        let work_area = monitor_info.rcWork;
        let x = work_area.left - frame.left;
        let y = work_area.top - frame.top;
        let width = rect_width(work_area) + frame.left + frame.right;
        let height = rect_height(work_area) + frame.top + frame.bottom;

        SetWindowPos(
            hwnd,
            Some(HWND::default()),
            x,
            y,
            width,
            height,
            SWP_NOZORDER | SWP_NOOWNERZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        )
        .map_err(|error| error.to_string())?;
    }

    Ok(true)
}

#[cfg(not(target_os = "windows"))]
fn platform_fit_window_to_work_area(_window: tauri::Window) -> Result<bool, String> {
    Ok(false)
}

#[cfg(target_os = "windows")]
#[derive(Clone, Copy, Default)]
struct FrameInsets {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[cfg(target_os = "windows")]
fn hidden_frame_insets(outer_rect: RECT, visible_rect: RECT) -> FrameInsets {
    FrameInsets {
        left: (visible_rect.left - outer_rect.left).max(0),
        top: (visible_rect.top - outer_rect.top).max(0),
        right: (outer_rect.right - visible_rect.right).max(0),
        bottom: (outer_rect.bottom - visible_rect.bottom).max(0),
    }
}

#[cfg(target_os = "windows")]
unsafe fn window_rect(hwnd: HWND) -> Result<RECT, String> {
    let mut rect = RECT::default();
    GetWindowRect(hwnd, &mut rect).map_err(|error| error.to_string())?;
    Ok(rect)
}

#[cfg(target_os = "windows")]
unsafe fn extended_frame_bounds(hwnd: HWND) -> Result<RECT, String> {
    let mut rect = RECT::default();
    DwmGetWindowAttribute(
        hwnd,
        DWMWA_EXTENDED_FRAME_BOUNDS,
        &mut rect as *mut _ as *mut _,
        size_of::<RECT>() as u32,
    )
    .map_err(|error| error.to_string())?;
    Ok(rect)
}

#[cfg(target_os = "windows")]
fn rect_width(rect: RECT) -> i32 {
    rect.right - rect.left
}

#[cfg(target_os = "windows")]
fn rect_height(rect: RECT) -> i32 {
    rect.bottom - rect.top
}
