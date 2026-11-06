// Windows / MFC / Winsock stand-ins for compiling the original Funeral Quest
// server's game logic on Linux (tools/oracle). Every Windows and MFC header
// the original includes resolves to this file. Game logic is compiled
// unmodified; this header only supplies the platform it was written for:
//   - Win32 types with their x86 sizes (the build is -m32, so long is 32-bit);
//   - CString (fq_cstring.h) and CArray with MFC semantics;
//   - Winsock address structures with the Windows layout (in_addr.S_un);
//   - the Microsoft C runtime rand()/srand() LCG, which glibc does not share;
//   - fopen with backslash paths, reads from the original legacy/dist tree
//     and writes into a scratch directory (fq_files.cpp);
//   - inert GUI, socket, speech, sound and registry stubs.
#pragma once
#ifndef FQ_WIN32_H
#define FQ_WIN32_H

// System headers first, so the macros at the end of this file cannot leak
// into them.
#include <algorithm>
#include <cassert>
#include <cctype>
#include <cmath>
#include <cstdarg>
#include <cstddef>
#include <stdint.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <cwchar>
#include <cwctype>
#include <functional>
#include <iostream>
#include <set>
#include <sstream>
#include <utility>
#include <deque>
#include <list>
#include <map>
#include <string>
#include <vector>
#include <fcntl.h>
#include <malloc.h>
#include <strings.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#include "fq_cstring.h"

#if !defined(__i386__)
#warning "oracle: not a 32-bit x86 build; long, time_t and pointer sizes differ from the original"
#endif
// Compile-time checks that work in C++98 (the original builds as C++98 here).
#define FQ_STATIC_CHECK(cond, name) typedef char fq_check_##name[(cond) ? 1 : -1]
FQ_STATIC_CHECK(sizeof(wchar_t) == 2, wchar_is_16_bit_use_fshort_wchar);

// ---------------------------------------------------------------- basic types
typedef int BOOL;
typedef unsigned char BYTE;
typedef unsigned char byte;
typedef unsigned short WORD;
typedef unsigned long DWORD;
typedef unsigned int UINT;
typedef int INT;
typedef long LONG;
typedef unsigned long ULONG;
typedef short SHORT;
typedef unsigned short USHORT;
typedef char CHAR;
typedef wchar_t WCHAR;
typedef char TCHAR;
typedef char _TCHAR;
typedef float FLOAT;
typedef double DOUBLE;
typedef char* LPSTR;
typedef const char* LPCSTR;
typedef char* LPTSTR;
typedef const char* LPCTSTR;
typedef char* PSTR;
typedef const char* PCSTR;
typedef wchar_t* LPWSTR;
typedef const wchar_t* LPCWSTR;
typedef wchar_t* LPOLESTR;
typedef const wchar_t* LPCOLESTR;
typedef wchar_t OLECHAR;
typedef wchar_t* BSTR;
typedef void* LPVOID;
typedef const void* LPCVOID;
typedef void VOID;
typedef BYTE* LPBYTE;
typedef DWORD* LPDWORD;
typedef WORD* LPWORD;
typedef long* LPLONG;
typedef int* LPINT;
typedef BOOL* LPBOOL;
typedef long LPARAM;
typedef unsigned int WPARAM;
typedef long LRESULT;
typedef long HRESULT;
typedef double DATE;
typedef long long LONGLONG;
typedef unsigned long long ULONGLONG;
typedef long long __int64;
typedef unsigned int UINT_PTR;
typedef long LONG_PTR;
typedef unsigned long ULONG_PTR;
typedef unsigned long DWORD_PTR;
typedef unsigned short ATOM;
typedef DWORD COLORREF;

struct fq_handle_ {
  int unused;
};
typedef void* HANDLE;
typedef fq_handle_* HWND;
typedef fq_handle_* HINSTANCE;
typedef fq_handle_* HMODULE;
typedef fq_handle_* HICON;
typedef fq_handle_* HCURSOR;
typedef fq_handle_* HMENU;
typedef fq_handle_* HDC;
typedef fq_handle_* HBRUSH;
typedef fq_handle_* HFONT;
typedef fq_handle_* HBITMAP;
typedef fq_handle_* HGDIOBJ;
typedef fq_handle_* HKEY;
typedef fq_handle_* HGLOBAL;
typedef int HFILE;
typedef unsigned int SOCKET;

#define TRUE 1
#define FALSE 0
#ifndef NULL
#define NULL 0
#endif
#define WINAPI
#define CALLBACK
#define APIENTRY
#define PASCAL
#define FAR
#define NEAR
#define far
#define near
#define __cdecl
#define __stdcall
#define _cdecl
#define __declspec(x)
#define __forceinline inline
#define afx_msg
#define AFXAPI
#define AFX_CDECL
#define IN
#define OUT
#define OPTIONAL
#define CONST const
#define MAX_PATH 260
#define _MAX_PATH 260
#define INFINITE 0xFFFFFFFF
#define INVALID_HANDLE_VALUE ((HANDLE)(long)-1)
#define INVALID_SOCKET (SOCKET)(~0)
#define SOCKET_ERROR (-1)
#define HFILE_ERROR ((HFILE)-1)
#define S_OK 0
#define E_FAIL ((HRESULT)0x80004005L)
#define SUCCEEDED(hr) (((HRESULT)(hr)) >= 0)
#define FAILED(hr) (((HRESULT)(hr)) < 0)
#define LOWORD(l) ((WORD)(((DWORD)(l)) & 0xffff))
#define HIWORD(l) ((WORD)((((DWORD)(l)) >> 16) & 0xffff))
#define LOBYTE(w) ((BYTE)(((DWORD)(w)) & 0xff))
#define HIBYTE(w) ((BYTE)((((DWORD)(w)) >> 8) & 0xff))
#define MAKEWORD(a, b) ((WORD)(((BYTE)(a)) | ((WORD)((BYTE)(b))) << 8))
#define MAKELONG(a, b) ((LONG)(((WORD)(a)) | ((DWORD)((WORD)(b))) << 16))
#define RGB(r, g, b) ((COLORREF)(((BYTE)(r) | ((WORD)((BYTE)(g)) << 8)) | (((DWORD)(BYTE)(b)) << 16)))
#define UNREFERENCED_PARAMETER(P) (void)(P)
#define ASSERT(x) ((void)0)
#define VERIFY(x) ((void)(x))
#define TRACE(...) ((void)0)
#define TRACE0(x) ((void)0)
#define ASSERT_VALID(x) ((void)0)
#define _T(x) x
#define TEXT(x) x
#define __T(x) x
#define _TEXT(x) x

typedef union _LARGE_INTEGER {
  struct {
    DWORD LowPart;
    LONG HighPart;
  } u;
  LONGLONG QuadPart;
} LARGE_INTEGER;

typedef struct _SYSTEMTIME {
  WORD wYear, wMonth, wDayOfWeek, wDay, wHour, wMinute, wSecond, wMilliseconds;
} SYSTEMTIME, *LPSYSTEMTIME;

typedef struct _FILETIME {
  DWORD dwLowDateTime, dwHighDateTime;
} FILETIME;

typedef struct _OSVERSIONINFO {
  DWORD dwOSVersionInfoSize, dwMajorVersion, dwMinorVersion, dwBuildNumber, dwPlatformId;
  CHAR szCSDVersion[128];
} OSVERSIONINFO, *LPOSVERSIONINFO;
typedef struct _OSVERSIONINFOEX {
  DWORD dwOSVersionInfoSize, dwMajorVersion, dwMinorVersion, dwBuildNumber, dwPlatformId;
  CHAR szCSDVersion[128];
  WORD wServicePackMajor, wServicePackMinor, wSuiteMask;
  BYTE wProductType, wReserved;
} OSVERSIONINFOEX;
#define VER_PLATFORM_WIN32_NT 2
#define VER_PLATFORM_WIN32_WINDOWS 1

typedef struct tagPOINT {
  LONG x, y;
} POINT, *LPPOINT;
typedef struct tagRECT {
  LONG left, top, right, bottom;
} RECT, *LPRECT;
typedef struct tagMSG {
  HWND hwnd;
  UINT message;
  WPARAM wParam;
  LPARAM lParam;
  DWORD time;
  POINT pt;
} MSG, *LPMSG;
typedef struct tagNMHDR {
  HWND hwndFrom;
  UINT_PTR idFrom;
  UINT code;
} NMHDR;
typedef struct _charformat {
  UINT cbSize;
  DWORD dwMask, dwEffects;
  LONG yHeight, yOffset;
  COLORREF crTextColor;
  BYTE bCharSet, bPitchAndFamily;
  char szFaceName[32];
} CHARFORMATA;
typedef struct _charformatw {
  UINT cbSize;
  DWORD dwMask, dwEffects;
  LONG yHeight, yOffset;
  COLORREF crTextColor;
  BYTE bCharSet, bPitchAndFamily;
  wchar_t szFaceName[32];
} CHARFORMATW;
typedef struct _SECURITY_ATTRIBUTES {
  DWORD nLength;
  LPVOID lpSecurityDescriptor;
  BOOL bInheritHandle;
} SECURITY_ATTRIBUTES;
struct VARIANT {
  int vt;
  void* parray;
};
struct SAFEARRAY {
  int unused;
};
struct SAFEARRAYBOUND {
  long lLbound;
  unsigned long cElements;
};
struct COleDateTime {
  double m_dt;
};
struct GUID {
  DWORD a;
  WORD b, c;
  BYTE d[8];
};

#define WM_USER 0x0400
#define WM_TIMER 0x0113
#define WM_CLOSE 0x0010
#define WM_COMMAND 0x0111
#define WM_SYSCOMMAND 0x0112
#define WM_PAINT 0x000F
#define WM_DESTROY 0x0002
#define WM_LBUTTONDOWN 0x0201
#define WM_RBUTTONDOWN 0x0204
#define WM_LBUTTONDBLCLK 0x0203
#define WM_KEYDOWN 0x0100
#define MB_OK 0
#define MB_ICONERROR 0x10
#define MB_ICONINFORMATION 0x40
#define MB_YESNO 4
#define MB_ICONWARNING 0x30
#define MB_ICONEXCLAMATION 0x30
#define IDOK 1
#define IDCANCEL 2
#define IDYES 6
#define IDNO 7
#define SW_SHOW 5
#define SW_SHOWNORMAL 1
#define SW_HIDE 0
#define SW_SHOWMINIMIZED 2
#define SW_RESTORE 9
#define LOCALE_USER_DEFAULT 0x0400
#define LOCALE_SYSTEM_DEFAULT 0x0800
#define DATE_SHORTDATE 1
#define DATE_LONGDATE 2
#define TIME_NOSECONDS 2
#define TIME_FORCE24HOURFORMAT 8
#define TIME_NOTIMEMARKER 4
#define CP_ACP 0
#define CP_UTF8 65001
#define MB_PRECOMPOSED 1
#define SND_FILENAME 0x00020000L
#define SND_ASYNC 0x0001
#define SND_SYNC 0x0000
#define SND_NODEFAULT 0x0002
#define FORMAT_MESSAGE_ALLOCATE_BUFFER 0x100
#define FORMAT_MESSAGE_FROM_SYSTEM 0x1000
#define FORMAT_MESSAGE_IGNORE_INSERTS 0x200
#define LANG_NEUTRAL 0
#define SUBLANG_DEFAULT 1
#define MAKELANGID(p, s) ((((WORD)(s)) << 10) | (WORD)(p))
#define LVS_EX_FULLROWSELECT 0x20
#define LVCFMT_LEFT 0
#define LVNI_SELECTED 2
#define LVIS_SELECTED 2
#define LVIS_FOCUSED 1
#define OFN_HIDEREADONLY 4
#define OFN_OVERWRITEPROMPT 2
#define OFN_FILEMUSTEXIST 0x1000
#define TPM_LEFTALIGN 0
#define TPM_RIGHTBUTTON 2
#define MF_STRING 0
#define VT_ARRAY 0x2000
#define VT_BSTR 8
#define _A_SUBDIR 0x10
#define _A_NORMAL 0

// --------------------------------------------------------------- Win32 calls
DWORD GetTickCount();
DWORD timeGetTime();
void Sleep(DWORD ms);
void OutputDebugString(LPCSTR s);
void OutputDebugStringA(LPCSTR s);
void OutputDebugStringW(LPCWSTR s);
BOOL PostMessage(HWND h, UINT msg, WPARAM w, LPARAM l);
LRESULT SendMessage(HWND h, UINT msg, WPARAM w, LPARAM l);
int MessageBox(HWND h, LPCSTR text, LPCSTR caption, UINT type);
int AfxMessageBox(LPCSTR text, UINT type = 0, UINT help = 0);
DWORD GetLastError();
void SetLastError(DWORD e);
DWORD FormatMessage(DWORD flags, LPCVOID src, DWORD id, DWORD lang, LPSTR buf, DWORD size, va_list* args);
void* LocalFree(void* p);
BOOL QueryPerformanceCounter(LARGE_INTEGER* li);
BOOL QueryPerformanceFrequency(LARGE_INTEGER* li);
void GetLocalTime(SYSTEMTIME* st);
void GetSystemTime(SYSTEMTIME* st);
int GetDateFormat(DWORD locale, DWORD flags, const SYSTEMTIME* st, LPCSTR fmt, LPSTR out, int n);
int GetTimeFormat(DWORD locale, DWORD flags, const SYSTEMTIME* st, LPCSTR fmt, LPSTR out, int n);
BOOL GetVersionEx(OSVERSIONINFO* info);
int MultiByteToWideChar(UINT cp, DWORD flags, LPCSTR src, int n, LPWSTR dst, int dn);
int WideCharToMultiByte(UINT cp, DWORD flags, LPCWSTR src, int n, LPSTR dst, int dn, LPCSTR def, LPBOOL used);
int lstrlen(LPCSTR s);
LPSTR lstrcpy(LPSTR d, LPCSTR s);
LPSTR lstrcat(LPSTR d, LPCSTR s);
int lstrcmp(LPCSTR a, LPCSTR b);
int lstrcmpi(LPCSTR a, LPCSTR b);
int wsprintf(LPSTR buf, LPCSTR fmt, ...);
int wvsprintf(LPSTR buf, LPCSTR fmt, va_list ap);
BOOL PlaySound(LPCSTR sound, HMODULE mod, DWORD flags);
HINSTANCE ShellExecute(HWND h, LPCSTR op, LPCSTR file, LPCSTR params, LPCSTR dir, int show);
DWORD GetModuleFileName(HMODULE h, LPSTR buf, DWORD n);
DWORD GetCurrentDirectory(DWORD n, LPSTR buf);
BOOL SetCurrentDirectory(LPCSTR p);
BOOL CreateDirectory(LPCSTR p, SECURITY_ATTRIBUTES* sa);
BOOL DeleteFile(LPCSTR p);
BOOL CopyFile(LPCSTR a, LPCSTR b, BOOL fail);
BOOL MoveFile(LPCSTR a, LPCSTR b);
DWORD GetFileAttributes(LPCSTR p);
BOOL GetCursorPos(POINT* p);
BOOL SetForegroundWindow(HWND h);
BOOL ShowWindow(HWND h, int cmd);
BOOL CloseHandle(HANDLE h);
BOOL DeleteObject(HGDIOBJ h);
HANDLE CreateMutex(SECURITY_ATTRIBUTES* sa, BOOL own, LPCSTR name);
DWORD WaitForSingleObject(HANDLE h, DWORD ms);
BOOL ReleaseMutex(HANDLE h);
#define NOERROR 0
#define E_OUTOFMEMORY ((HRESULT)0x8007000EL)
#define HRESULT_FROM_WIN32(x) ((HRESULT)(x) <= 0 ? ((HRESULT)(x)) : ((HRESULT)(((x)&0x0000FFFF) | (7 << 16) | 0x80000000)))
#define ZeroMemory(p, n) memset((p), 0, (n))
#define CopyMemory(d, s, n) memcpy((d), (s), (n))
#define FillMemory(d, n, c) memset((d), (c), (n))
#define MoveMemory(d, s, n) memmove((d), (s), (n))
#define INVALID_FILE_ATTRIBUTES ((DWORD)-1)
#define FILE_ATTRIBUTE_DIRECTORY 0x10
#define ERROR_ALREADY_EXISTS 183L

// Registry, processes, directory search: used only by utilities the game
// logic never calls (LaunchURL, RunProcess...). They fail.
#define HKEY_CLASSES_ROOT ((HKEY)0)
#define HKEY_CURRENT_USER ((HKEY)0)
#define HKEY_LOCAL_MACHINE ((HKEY)0)
#define KEY_QUERY_VALUE 1
#define KEY_ALL_ACCESS 0xF003F
#define REG_SZ 1
#define REG_DWORD 4
#define ERROR_SUCCESS 0L
#define ERROR_FILE_NOT_FOUND 2L
#define ERROR_PATH_NOT_FOUND 3L
#define ERROR_BAD_FORMAT 11L
#define SE_ERR_ACCESSDENIED 5
#define SE_ERR_ASSOCINCOMPLETE 27
#define SE_ERR_DDEBUSY 30
#define SE_ERR_DDEFAIL 29
#define SE_ERR_DDETIMEOUT 28
#define SE_ERR_DLLNOTFOUND 32
#define SE_ERR_FNF 2
#define SE_ERR_NOASSOC 31
#define SE_ERR_OOM 8
#define SE_ERR_PNF 3
#define SE_ERR_SHARE 26
#define GMEM_FIXED 0
#define SW_SHOWDEFAULT 10
#define SW_MINIMIZE 6
#define MB_ICONSTOP 0x10
#define MB_SETFOREGROUND 0x10000
#define MB_TOPMOST 0x40000
#define MB_YESNOCANCEL 3
#define STARTF_USESHOWWINDOW 1
#define NORMAL_PRIORITY_CLASS 0x20
#define CREATE_NEW_CONSOLE 0x10
long RegOpenKeyEx(HKEY, LPCSTR, DWORD, DWORD, HKEY*);
long RegQueryValueEx(HKEY, LPCSTR, DWORD*, DWORD*, BYTE*, DWORD*);
long RegSetValueEx(HKEY, LPCSTR, DWORD, DWORD, const BYTE*, DWORD);
long RegCreateKeyEx(HKEY, LPCSTR, DWORD, LPSTR, DWORD, DWORD, SECURITY_ATTRIBUTES*, HKEY*, DWORD*);
long RegCloseKey(HKEY);
HGLOBAL GlobalAlloc(UINT, size_t);
HGLOBAL GlobalFree(void*);
typedef struct _STARTUPINFO {
  DWORD cb;
  LPSTR lpReserved, lpDesktop, lpTitle;
  DWORD dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
  WORD wShowWindow, cbReserved2;
  BYTE* lpReserved2;
  HANDLE hStdInput, hStdOutput, hStdError;
} STARTUPINFO;
typedef struct _PROCESS_INFORMATION {
  HANDLE hProcess, hThread;
  DWORD dwProcessId, dwThreadId;
} PROCESS_INFORMATION;
BOOL CreateProcess(LPCSTR, LPSTR, SECURITY_ATTRIBUTES*, SECURITY_ATTRIBUTES*, BOOL, DWORD, LPVOID,
                   LPCSTR, STARTUPINFO*, PROCESS_INFORMATION*);
typedef struct _WIN32_FIND_DATA {
  DWORD dwFileAttributes;
  FILETIME ftCreationTime, ftLastAccessTime, ftLastWriteTime;
  DWORD nFileSizeHigh, nFileSizeLow, dwReserved0, dwReserved1;
  CHAR cFileName[MAX_PATH];
  CHAR cAlternateFileName[14];
} WIN32_FIND_DATA, *LPWIN32_FIND_DATA;
HANDLE FindFirstFile(LPCSTR, WIN32_FIND_DATA*);
BOOL FindNextFile(HANDLE, WIN32_FIND_DATA*);
BOOL FindClose(HANDLE);
class CWinApp;
CWinApp* AfxGetApp();
HINSTANCE AfxGetInstanceHandle();

// ------------------------------------------------- Microsoft C runtime pieces
// rand()/srand() are the MSVC CRT's: state = state * 214013 + 2531011,
// output (state >> 16) & 0x7fff. glibc's rand() is a different generator.
int fq_ms_rand();
void fq_ms_srand(unsigned int seed);
#undef RAND_MAX
#define RAND_MAX 0x7fff

int stricmp(const char* a, const char* b);
int strnicmp(const char* a, const char* b, size_t n);
#define _stricmp stricmp
#define _strnicmp strnicmp
#define _strcmpi stricmp
#define strcmpi stricmp
#define _mbsicmp stricmp
char* strupr(char* s);
char* strrev(char* s);
#define _strrev strrev
char* _strnset(char* s, int c, size_t n);
char* _strset(char* s, int c);
char* strlwr(char* s);
#define _strupr strupr
#define _strlwr strlwr
char* itoa(int v, char* buf, int radix);
char* ltoa(long v, char* buf, int radix);
char* ultoa(unsigned long v, char* buf, int radix);
#define _itoa itoa
#define _ltoa ltoa
#define _ultoa ultoa
#define _strdup strdup
#define _unlink unlink
#define _access fq_access
#define _getpid getpid
#define _snprintf fq_snprintf_ms
#define _vsnprintf fq_vsnprintf_ms
#define _stat stat
#define _isnan std::isnan
#define _finite std::isfinite
char* _getcwd(char* buf, int n);
int _chdir(const char* p);
int fq_mkdir(const char* p);
#define _mkdir fq_mkdir
#define _rmdir rmdir
char* _strtime(char* buf);
char* _strdate(char* buf);
struct _finddata_t {
  unsigned attrib;
  long time_create, time_access, time_write;
  unsigned long size;
  char name[260];
};
long _findfirst(const char* spec, _finddata_t* data);
int _findnext(long h, _finddata_t* data);
int _findclose(long h);
long _filelength(int fd);
#define _O_RDONLY O_RDONLY
#define _O_BINARY 0
#define O_BINARY 0
uintptr_t _beginthread(void (*fn)(void*), unsigned stack, void* arg);

// --------------------------------------------------------------- wide strings
// The build uses -fshort-wchar so WCHAR is 16-bit as on Windows (the scripts
// in legacy/dist/script are UTF-16). glibc's wcs* functions assume a 32-bit
// wchar_t, so these are reimplemented (fq_wide.cpp) and swapped in by macro.
size_t fq_wcslen(const wchar_t* s);
wchar_t* fq_wcscpy(wchar_t* d, const wchar_t* s);
wchar_t* fq_wcsncpy(wchar_t* d, const wchar_t* s, size_t n);
wchar_t* fq_wcscat(wchar_t* d, const wchar_t* s);
int fq_wcscmp(const wchar_t* a, const wchar_t* b);
int fq_wcsncmp(const wchar_t* a, const wchar_t* b, size_t n);
int fq_wcsicmp(const wchar_t* a, const wchar_t* b);
int fq_wcsnicmp(const wchar_t* a, const wchar_t* b, size_t n);
wchar_t* fq_wcschr(const wchar_t* s, wchar_t c);
wchar_t* fq_wcsrchr(const wchar_t* s, wchar_t c);
wchar_t* fq_wcsstr(const wchar_t* s, const wchar_t* sub);
wchar_t* fq_wcspbrk(const wchar_t* s, const wchar_t* set);
wchar_t* fq_wcsupr(wchar_t* s);
wchar_t* fq_wcslwr(wchar_t* s);
int fq_wtoi(const wchar_t* s);
long fq_wtol(const wchar_t* s);
double fq_wtof(const wchar_t* s);
double fq_wcstod(const wchar_t* s, wchar_t** end);
long fq_wcstol(const wchar_t* s, wchar_t** end, int base);
int fq_iswspace(wchar_t c);
int fq_iswdigit(wchar_t c);
wchar_t fq_towlower(wchar_t c);
wchar_t fq_towupper(wchar_t c);
int fq_swprintf16(wchar_t* buf, const wchar_t* fmt, ...);
int fq_vswprintf16(wchar_t* buf, const wchar_t* fmt, va_list ap);
FILE* fq_wfopen(const wchar_t* name, const wchar_t* mode);

// ------------------------------------------------------------ printf family
int fq_vsprintf(char* buf, const char* fmt, va_list ap);
int fq_sprintf(char* buf, const char* fmt, ...);
int fq_vsnprintf_ms(char* buf, size_t count, const char* fmt, va_list ap);
int fq_snprintf_ms(char* buf, size_t count, const char* fmt, ...);
int fq_vprintf(const char* fmt, va_list ap);
int fq_printf(const char* fmt, ...);
int fq_vfprintf(FILE* f, const char* fmt, va_list ap);
int fq_fprintf(FILE* f, const char* fmt, ...);

// ------------------------------------------------------------------- files
// fopen with Windows paths: backslashes become slashes; reads look in the
// scratch directory first and then in the original content tree (case-
// insensitive, as NTFS is); writes go to the scratch directory.
FILE* fq_fopen(const char* name, const char* mode);
int fq_unlink(const char* name);
int fq_access(const char* name, int mode);
int fq_remove(const char* name);
int fq_rename(const char* a, const char* b);
int fq_chdir(const char* p);

// ------------------------------------------------------------------ winsock
struct in_addr {
  union {
    struct {
      unsigned char s_b1, s_b2, s_b3, s_b4;
    } S_un_b;
    struct {
      unsigned short s_w1, s_w2;
    } S_un_w;
    unsigned long S_addr;
  } S_un;
};
#define s_addr S_un.S_addr
typedef struct sockaddr {
  unsigned short sa_family;
  char sa_data[14];
} SOCKADDR, *LPSOCKADDR, *PSOCKADDR;
struct sockaddr_in {
  short sin_family;
  unsigned short sin_port;
  struct in_addr sin_addr;
  char sin_zero[8];
};
typedef struct sockaddr_in SOCKADDR_IN, *LPSOCKADDR_IN, *PSOCKADDR_IN;
typedef struct in_addr IN_ADDR;
struct hostent {
  char* h_name;
  char** h_aliases;
  short h_addrtype;
  short h_length;
  char** h_addr_list;
};
typedef struct hostent HOSTENT, *LPHOSTENT;
struct WSADATA {
  WORD wVersion, wHighVersion;
  char szDescription[257];
  char szSystemStatus[129];
};
#define AF_INET 2
#define SOCK_STREAM 1
#define INADDR_ANY 0
#define FD_READ 1
#define FD_WRITE 2
#define FD_ACCEPT 8
#define FD_CLOSE 32
#if defined(__i386__)
FQ_STATIC_CHECK(sizeof(in_addr) == 4, in_addr_is_4_bytes);
FQ_STATIC_CHECK(sizeof(long) == 4, long_is_32_bit);
FQ_STATIC_CHECK(sizeof(time_t) == 4, time_t_is_32_bit);
#endif
char* inet_ntoa(struct in_addr in);
unsigned long inet_addr(const char* cp);
unsigned short htons(unsigned short v);
unsigned short ntohs(unsigned short v);
unsigned long htonl(unsigned long v);
unsigned long ntohl(unsigned long v);
int closesocket(SOCKET s);
int send(SOCKET s, const char* buf, int len, int flags);
int recv(SOCKET s, char* buf, int len, int flags);
int WSAGetLastError();
int WSAAsyncSelect(SOCKET s, HWND h, UINT msg, long ev);

// --------------------------------------------------------------- MFC: misc
#define DECLARE_MESSAGE_MAP()
#define DECLARE_DYNAMIC(c)
#define DECLARE_DYNCREATE(c)
#define IMPLEMENT_DYNAMIC(c, b)
#define IMPLEMENT_DYNCREATE(c, b)
#define BEGIN_MESSAGE_MAP(c, b)
#define END_MESSAGE_MAP()
#define AFX_MANAGE_STATE(x)
typedef void* POSITION;
#define LPCRECT_dummy const RECT*

class CObject {
 public:
  virtual ~CObject() {}
};

class CDataExchange {};
class CWnd : public CObject {
 public:
  HWND m_hWnd;
  CWnd() : m_hWnd(0) {}
  virtual ~CWnd() {}
  BOOL ShowWindow(int) { return TRUE; }
  void SetWindowText(LPCSTR) {}
  void GetWindowText(CString& s) const { s = ""; }
  BOOL EnableWindow(BOOL = TRUE) { return TRUE; }
  CWnd* GetDlgItem(int) const { return 0; }
  BOOL UpdateData(BOOL = TRUE) { return TRUE; }
  void Invalidate(BOOL = TRUE) {}
  BOOL PostMessage(UINT, WPARAM = 0, LPARAM = 0) { return TRUE; }
  LRESULT SendMessage(UINT, WPARAM = 0, LPARAM = 0) { return 0; }
  int MessageBox(LPCSTR, LPCSTR = 0, UINT = 0) { return IDOK; }
  BOOL SetForegroundWindow() { return TRUE; }
};
class CDialog : public CWnd {
 public:
  CDialog() {}
  CDialog(UINT, CWnd* = 0) {}
  virtual int DoModal() { return IDCANCEL; }
  virtual BOOL OnInitDialog() { return TRUE; }
  virtual void OnOK() {}
  virtual void OnCancel() {}
  virtual void DoDataExchange(CDataExchange*) {}
  virtual BOOL PreTranslateMessage(MSG*) { return FALSE; }
  virtual LRESULT WindowProc(UINT, WPARAM, LPARAM) { return 0; }
  void EndDialog(int) {}
};
class CWinThread : public CObject {};
class CWinApp : public CObject {
 public:
  CWnd* m_pMainWnd;
  CWinApp() : m_pMainWnd(0) {}
  virtual BOOL InitInstance() { return TRUE; }
  virtual BOOL PreTranslateMessage(MSG*) { return FALSE; }
};
typedef UINT (*AFX_THREADPROC)(LPVOID);
CWinThread* AfxBeginThread(AFX_THREADPROC fn, LPVOID param, int prio = 0, UINT stack = 0,
                           DWORD flags = 0, SECURITY_ATTRIBUTES* sa = 0);
#define THREAD_PRIORITY_NORMAL 0
#define THREAD_PRIORITY_LOWEST (-2)

class CListCtrl : public CWnd {
 public:
  int GetItemCount() const { return 0; }
  int InsertItem(int i, LPCSTR) { return i; }
  BOOL SetItemText(int, int, LPCSTR) { return TRUE; }
  CString GetItemText(int, int) const { return CString(); }
  BOOL SetItemData(int, DWORD_PTR) { return TRUE; }
  DWORD_PTR GetItemData(int) const { return 0; }
  BOOL DeleteItem(int) { return TRUE; }
  BOOL DeleteAllItems() { return TRUE; }
  int InsertColumn(int, LPCSTR, int = 0, int = -1, int = -1) { return 0; }
  DWORD SetExtendedStyle(DWORD) { return 0; }
  POSITION GetFirstSelectedItemPosition() const { return 0; }
  int GetNextSelectedItem(POSITION&) const { return -1; }
  BOOL SortItems(int (*)(LPARAM, LPARAM, LPARAM), DWORD_PTR) { return TRUE; }
  int GetNextItem(int, int) const { return -1; }
  BOOL SetItemState(int, UINT, UINT) { return TRUE; }
  BOOL EnsureVisible(int, BOOL) { return TRUE; }
};
class CComboBox : public CWnd {
 public:
  int GetCount() const { return 0; }
  int GetItemData(int) const { return 0; }
  int SetCurSel(int) { return 0; }
  int GetCurSel() const { return -1; }
  int AddString(LPCSTR) { return 0; }
  int SetItemData(int, DWORD_PTR) { return 0; }
  void ResetContent() {}
};
class CListBox : public CComboBox {};
class CEdit : public CWnd {
 public:
  void SetSel(int, int, BOOL = FALSE) {}
  void ReplaceSel(LPCSTR, BOOL = FALSE) {}
  int GetLineCount() const { return 0; }
};
class CButton : public CWnd {
 public:
  int GetCheck() const { return 0; }
  void SetCheck(int) {}
};
class CMenu : public CObject {
 public:
  BOOL LoadMenu(UINT) { return TRUE; }
  CMenu* GetSubMenu(int) { return this; }
  BOOL TrackPopupMenu(UINT, int, int, CWnd*, LPCRECT_dummy = 0) { return TRUE; }
  BOOL AppendMenu(UINT, UINT_PTR = 0, LPCSTR = 0) { return TRUE; }
  BOOL CreatePopupMenu() { return TRUE; }
};
class CFileDialog : public CDialog {
 public:
  struct { DWORD Flags; LPCSTR lpstrInitialDir; LPCSTR lpstrTitle; } m_ofn;
  CFileDialog(BOOL, LPCSTR = 0, LPCSTR = 0, DWORD = 0, LPCSTR = 0, CWnd* = 0) {}
  CString GetPathName() const { return CString(); }
  CString GetFileName() const { return CString(); }
};
class CAsyncSocket : public CObject {
 public:
  SOCKET m_hSocket;
  CAsyncSocket() : m_hSocket(0) {}
  virtual ~CAsyncSocket() {}
  BOOL Create(UINT = 0, int = 1, long = 63, LPCSTR = 0) { return FALSE; }
  BOOL Connect(LPCSTR, UINT) { return FALSE; }
  int Send(const void*, int, int = 0) { return 0; }
  int Receive(void*, int, int = 0) { return 0; }
  virtual void Close() {}
  virtual void OnConnect(int) {}
  virtual void OnReceive(int) {}
  virtual void OnSend(int) {}
  virtual void OnClose(int) {}
  virtual void OnAccept(int) {}
};
class CSocket : public CAsyncSocket {};
class CRichEditCtrl : public CEdit {};
class CStatic : public CWnd {};
class CSpinButtonCtrl : public CWnd {};
class CProgressCtrl : public CWnd {};
class CToolTipCtrl : public CWnd {};
class CPoint : public POINT {
 public:
  CPoint() { x = y = 0; }
  CPoint(int a, int b) { x = a; y = b; }
};
class CRect : public RECT {
 public:
  CRect() { left = top = right = bottom = 0; }
  int Width() const { return right - left; }
  int Height() const { return bottom - top; }
};
class CDC {};
class CPaintDC : public CDC {
 public:
  CPaintDC(CWnd*) {}
};

// ------------------------------------------------------- MFC: collections
// CArray as MFC defines it: new elements are zeroed and default-constructed,
// SetSize keeps the existing ones, RemoveAt shifts the rest down.
template <class TYPE, class ARG_TYPE = const TYPE&>
class CArray : public CObject {
 public:
  CArray() {}
  CArray(const CArray& o) : v(o.v) {}
  CArray& operator=(const CArray& o) {
    v = o.v;
    return *this;
  }
  int GetSize() const { return (int)v.size(); }
  int GetCount() const { return (int)v.size(); }
  int GetUpperBound() const { return (int)v.size() - 1; }
  bool IsEmpty() const { return v.empty(); }
  void SetSize(int n, int = -1) { v.resize(n < 0 ? 0 : n); }
  void RemoveAll() { v.clear(); }
  void FreeExtra() {}
  TYPE GetAt(int i) const { return v[i]; }
  TYPE& GetAt(int i) { return v[i]; }
  void SetAt(int i, ARG_TYPE e) { v[i] = e; }
  TYPE& ElementAt(int i) { return v[i]; }
  const TYPE& ElementAt(int i) const { return v[i]; }
  TYPE* GetData() { return v.empty() ? 0 : &v[0]; }
  const TYPE* GetData() const { return v.empty() ? 0 : &v[0]; }
  void SetAtGrow(int i, ARG_TYPE e) {
    if (i >= (int)v.size()) v.resize(i + 1);
    v[i] = e;
  }
  int Add(ARG_TYPE e) {
    TYPE copy = e;
    v.push_back(copy);
    return (int)v.size() - 1;
  }
  int Append(const CArray& o) {
    int at = (int)v.size();
    v.insert(v.end(), o.v.begin(), o.v.end());
    return at;
  }
  void Copy(const CArray& o) { v = o.v; }
  void InsertAt(int i, ARG_TYPE e, int n = 1) {
    TYPE copy = e;
    if (i >= (int)v.size()) {
      v.resize(i);
      for (int k = 0; k < n; k++) v.push_back(copy);
    } else {
      v.insert(v.begin() + i, n, copy);
    }
  }
  void RemoveAt(int i, int n = 1) { v.erase(v.begin() + i, v.begin() + i + n); }
  TYPE& operator[](int i) { return v[i]; }
  const TYPE& operator[](int i) const { return v[i]; }

 private:
  std::vector<TYPE> v;
};
typedef CArray<DWORD, DWORD> CDWordArray;
typedef CArray<UINT, UINT> CUIntArray;
typedef CArray<WORD, WORD> CWordArray;
typedef CArray<BYTE, BYTE> CByteArray;
typedef CArray<void*, void*> CPtrArray;
typedef CArray<CString, LPCSTR> CStringArray;

// ------------------------------------------------------------ MFC: CTime
class CTime {
 public:
  CTime() : t(0) {}
  CTime(time_t v) : t(v) {}
  static CTime GetCurrentTime();
  time_t GetTime() const { return t; }
  int GetYear() const;
  int GetMonth() const;
  int GetDay() const;
  int GetHour() const;
  int GetMinute() const;
  int GetSecond() const;
  int GetDayOfWeek() const;
  CString Format(LPCSTR fmt) const;

 private:
  time_t t;
};

#define CWinAppEx CWinApp

// ---------------------------------------------------------------- tchar.h
#define _tcslen strlen
#define _tcscpy strcpy
#define _tcsncpy strncpy
#define _tcsncat strncat
#define _tchdir chdir
#define _tunlink unlink
#define _trename rename
#define _fgetts fgets
#define _tremove remove
#define _taccess access
#define _tcsrev strrev
#define _tcstol strtol
#define _tcstod strtod
#define _tcsftime strftime
#define _tgetcwd _getcwd
#define _tmkdir _mkdir
#define _fputts fputs
#define _tcscat strcat
#define _tcscmp strcmp
#define _tcsicmp stricmp
#define _tcsnicmp strnicmp
#define _tcsncmp strncmp
#define _tcsstr strstr
#define _tcschr strchr
#define _tcsrchr strrchr
#define _tcspbrk strpbrk
#define _tcsupr strupr
#define _tcslwr strlwr
#define _tcstok strtok
#define _tcsdup strdup
#define _ttoi atoi
#define _ttol atol
#define _tstof atof
#define _tstoi atoi
#define _tfopen fopen
#define _istspace isspace
#define _istdigit isdigit
#define _istalpha isalpha
#define _totlower tolower
#define _totupper toupper
#define _stprintf sprintf
#define _vstprintf vsprintf
#define _sntprintf _snprintf
#define _tprintf printf
#define _tmain main

// ------------------------------------------------------ redirections (last)
#define rand fq_ms_rand
#define srand fq_ms_srand
#define sprintf fq_sprintf
#define vsprintf fq_vsprintf
#define printf fq_printf
#define vprintf fq_vprintf
#define fprintf fq_fprintf
#define vfprintf fq_vfprintf
#define fopen fq_fopen
#define unlink fq_unlink
#define remove fq_remove
#define rename fq_rename
#define chdir fq_chdir
extern "C" int fq_stat(const char* name, struct stat* st);
#define stat(a, b) fq_stat(a, b)
// The clock is the harness's (fq_winapi.cpp): time() and the tick counters
// read it, so a run does not depend on when it happens.
time_t fq_time(time_t* t);
#define time(t) fq_time(t)
#define wcslen fq_wcslen
#define wcscpy fq_wcscpy
#define wcsncpy fq_wcsncpy
#define wcscat fq_wcscat
#define wcscmp fq_wcscmp
#define wcsncmp fq_wcsncmp
#define wcsicmp fq_wcsicmp
#define _wcsicmp fq_wcsicmp
#define wcsnicmp fq_wcsnicmp
#define _wcsnicmp fq_wcsnicmp
#define wcschr fq_wcschr
#define wcsrchr fq_wcsrchr
#define wcsstr fq_wcsstr
#define wcspbrk fq_wcspbrk
#define _wcsupr fq_wcsupr
#define wcsupr fq_wcsupr
#define _wcslwr fq_wcslwr
#define wcslwr fq_wcslwr
#define _wtoi fq_wtoi
#define _wtol fq_wtol
#define _wtof fq_wtof
#define wcstod fq_wcstod
#define wcstol fq_wcstol
#define iswspace fq_iswspace
#define iswdigit fq_iswdigit
#define towlower fq_towlower
#define towupper fq_towupper
#define swprintf fq_swprintf16
#define vswprintf fq_vswprintf16
#define _wfopen fq_wfopen

#endif
