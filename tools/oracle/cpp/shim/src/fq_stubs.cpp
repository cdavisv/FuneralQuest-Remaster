// Stand-ins for the parts of the original server that are not compiled:
// the MFC dialog (fqDlg.cpp), the HTTP server (httpa.c), the licence
// connection (server_connect.cpp) and speech (CSpeech.cpp). Each stub states
// what the original did. None of them touches game state except where noted.
#include "stdafx.h"

#include "CProtection.h"
#include "CSpeech.h"
#include "resource.h"
#include "fqdlg.h"
#include "funeral.h"
#include "fq_capture.h"
#include "server_connect.h"

// fqDlg.cpp:37-40 -------------------------------------------------------------
online_struct** p_on;
online_global g_on;
static CFqDlg g_fq_dialog;
CFqDlg* g_dlg_main = &g_fq_dialog;  // never NULL: log_error dereferences it
HWND g_hwnd_main = NULL;

CFqDlg::CFqDlg(CWnd*) {}
void CFqDlg::reinit_user_list() {}
void CFqDlg::user_list_remove(int) {}
void CFqDlg::user_list_update_time(online_struct*) {}
bool CFqDlg::user_list_update(LPREQUEST) { return true; }
bool CFqDlg::user_list_add(LPREQUEST) { return true; }
void CFqDlg::timer_kill() {}
bool CFqDlg::timer_init() { return true; }
void CFqDlg::init_user_list() {}
void CFqDlg::Log(CString cst_message) { fq_log_line((LPCSTR)cst_message); }
BOOL CFqDlg::PreTranslateMessage(MSG*) { return FALSE; }
void CFqDlg::DoDataExchange(CDataExchange*) {}
LRESULT CFqDlg::WindowProc(UINT, WPARAM, LPARAM) { return 0; }
BOOL CFqDlg::OnInitDialog() { return TRUE; }

// The dialog's window procedure printed WM_ADD_TO_LOG text into the log box
// and freed it (fqDlg.cpp:333-450); here it goes to the log sink.
BOOL PostMessage(HWND, UINT msg, WPARAM, LPARAM l) {
  if (msg == WM_ADD_TO_LOG && l) {
    fq_log_line((const char*)l);
    free((void*)l);
  }
  return TRUE;
}

// httpa.c ---------------------------------------------------------------------
// send_msg (httpa.c:105-135) appended "/r/n", web-encoded the text and wrote
// it to the socket. The oracle records the text the game logic built.
void send_msg(LPREQUEST lpReq, CString cst_final) { fq_capture_response(lpReq, (LPCSTR)cst_final); }
void SendError(LPREQUEST lpReq, UINT uError) {
  CString s;
  s.Format("HTTP_ERROR=%u&", uError);
  fq_capture_response(lpReq, (LPCSTR)s);
}
void CloseConnection(LPREQUEST) {}
BOOL StartHTTP(LPHTTPSERVINFO) { return TRUE; }
void StopHTTP(void) {}

// server_connect.cpp:97-107: with the DRM removed, the licence thread only
// sets these limits. AfxBeginThread runs it at once (fq_winapi.cpp).
UINT get_server_dat(LPVOID) {
  cls_pro.i_max_on = 500;
  cls_pro.i_max_players = 5000;
  cls_pro.b_validated = true;
  return 0;
}
void force_reconnect() {}

// CSpeech.cpp: text to speech, silent here.
CSpeech::CSpeech() : pVoice(NULL), b_muted(true) {}
CSpeech::~CSpeech() {}
void CSpeech::set_mute(bool b_new) { b_muted = b_new; }
void CSpeech::say(const LPCSTR, ...) {}
void CSpeech::say(const WCHAR[], DWORD) {}

// CProtection.cpp:11-25. The licence class does not compile with g++, and
// only its constructor matters to the game: it seeds both generators from the
// clock (randomize, all.cpp:888-892) and draws once. The harness reseeds both
// afterwards, so this only keeps start-up identical.
CProtection cls_pro;
CProtection::CProtection() {
  st_license[0] = 0;
  b_validated = false;
  i_max_players = 0;
  i_max_on = 0;
  randomize();
  m_i_master_seed = random(100000);
  m_b_use_fixed_reduce = false;
  m_b_serial_mod_active = false;
  m_st_name[0] = 0;
}
