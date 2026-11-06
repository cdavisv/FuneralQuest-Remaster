import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ORACLE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const REPO_ROOT = resolve(ORACLE_DIR, "..", "..");
export const LEGACY_SOURCE_DIR = join(REPO_ROOT, "legacy", "source");
export const LEGACY_DIST_DIR = join(REPO_ROOT, "legacy", "dist");
export const BUILD_DIR = join(ORACLE_DIR, "build");
export const BINARY = join(BUILD_DIR, "fq-oracle");
export const SHIM_INCLUDE = join(ORACLE_DIR, "cpp", "shim", "include");

/**
 * The original's game logic, compiled unmodified. This is fq.vcxproj's list
 * minus the GUI (fqDlg, fq.cpp, dlg_*, StrListCtrl, user_list, dlg_tray,
 * window_timer), networking (httpa.c, reqlist.c, Server.cpp, server_connect,
 * alert_socket, CRobotInternet, winsock_util), the licence server
 * (license_process, CEncrypt), speech (CSpeech), the zip library (CFileLib)
 * and the Unicode build helpers (mfc_all_u). CProtection.cpp (licence keys)
 * does not compile with g++ (`unsigned long (x)` casts, CProtection.cpp:303);
 * its constructor, which the game depends on, is reproduced in fq_stubs.cpp. commands.cpp, new_user.cpp, player.cpp and the
 * commands_{newday,main,news,rankings}.cpp files are #included by
 * funeral.cpp, as in the original project.
 */
export const LEGACY_SOURCES = [
  "broadcast.cpp",
  "CAutoSave.cpp",
  "CEvent.cpp",
  "commands_bank.cpp",
  "commands_bar.cpp",
  "commands_battle.cpp",
  "commands_city_hall.cpp",
  "commands_comp.cpp",
  "commands_complicated.cpp",
  "commands_customer.cpp",
  "commands_customer_risk.cpp",
  "commands_getname.cpp",
  "commands_map.cpp",
  "commands_misc.cpp",
  "commands_send_mail.cpp",
  "commands_spirit.cpp",
  "commands_yangs.cpp",
  "command_hospital.cpp",
  "command_options.cpp",
  "command_random.cpp",
  "command_script.cpp",
  "command_script_misc.cpp",
  "command_script_vars.cpp",
  "command_store.cpp",
  "COptions.cpp",
  "create_customer.cpp",
  "FakeCStringEx.cpp",
  "file_system.cpp",
  "funeral.cpp",
  "funeral_file.cpp",
  "funeral_util.cpp",
  "globals.cpp",
  "location_data.cpp",
  "maint.cpp",
  "message_que.cpp",
  "misc_utils.cpp",
  "online_struct.cpp",
  "online_util.cpp",
  "player_file.cpp",
  "player_struct.cpp",
  "rankings.cpp",
  "reset_game.cpp",
  "security.cpp",
  "server_settings.cpp",
  "shared_util.cpp",
  "transportation.cpp",
  "shared/all.cpp",
  "shared/CRandom.cpp",
  "shared/CScript.cpp",
  "shared/CScriptEngine.cpp",
  "shared/CScriptFunction.cpp",
  "shared/CScriptOp.cpp",
  "shared/CScriptParse.cpp",
  "shared/CScriptVar.cpp",
  "shared/CScriptVarBase.cpp",
  "shared/CTextParse.cpp",
  "shared/CTimer.cpp",
  "shared/mfc_all.cpp",
  "shared/std_all.cpp",
  "shared/timer.cpp",
  "shared/uni.cpp",
  "shared/unicode_utils.cpp",
];

export const SHIM_SOURCES = [
  "fq_cstring.cpp",
  "fq_format.cpp",
  "fq_wide.cpp",
  "fq_files.cpp",
  "fq_winapi.cpp",
  "fq_stubs.cpp",
];

export const HARNESS_SOURCES = ["oracle_main.cpp"];

/** fq.vcxproj, Release|Win32 preprocessor definitions. */
export const DEFINES = [
  "WIN32",
  "NDEBUG",
  "_WINDOWS",
  "_NO_ZLIB",
  "_CRT_SECURE_NO_DEPRECATE=1",
  "WINVER=0x0501",
  "_USE_32BIT_TIME_T",
  "_WIN32_WINNT=0x501",
  "_NO_SECURITY",
  "_AFXDLL",
];

/**
 * Floating point: fq.vcxproj sets no FloatingPointModel (so /fp:precise) and
 * no EnableEnhancedInstructionSet (so the v142 x86 default, /arch:SSE2).
 * MSVC then evaluates float expressions in SSE registers at float precision.
 * -msse2 -mfpmath=sse (added for 32-bit) does the same; -ffp-contract=off
 * forbids fused multiply-add, which /fp:precise does not emit for x86 either.
 *
 * -O0 keeps the generated code close to the source: the original has a few
 * out-of-bounds writes (commands_yangs.cpp:13-33) whose effect an optimizer
 * could change. -fwrapv: MSVC does not exploit signed overflow. -fpermissive
 * accepts MSVC-isms (extra qualification on members, and so on).
 */
export const CXX_FLAGS = [
  "-O0",
  "-g",
  "-fpermissive",
  "-fshort-wchar",
  "-fwrapv",
  "-fno-strict-aliasing",
  "-ffp-contract=off",
  "-fno-fast-math",
  "-fsigned-char",
];

/**
 * The original is compiled as C++98: it relies on rules C++11 removed, such as
 * `return false;` from a function returning a pointer (CTextParse.cpp:81),
 * which MSVC still accepts. Warnings are off for code we may not change.
 */
export const LEGACY_FLAGS = ["-std=gnu++98", "-w"];
/** gnu++14, not 17: the original's `using namespace std` would clash with std::byte. */
export const SHIM_FLAGS = ["-std=gnu++14", "-Wall", "-Wno-unused-function", "-Wno-unknown-pragmas"];
