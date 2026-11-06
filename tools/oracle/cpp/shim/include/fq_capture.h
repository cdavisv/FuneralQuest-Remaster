// Hooks between the shim and the oracle harness (cpp/harness/oracle_main.cpp).
#pragma once

struct tagREQUEST;

// A response the server sent (send_msg / SendError), before web encoding.
void fq_capture_response(struct tagREQUEST* lpReq, const char* text);
// A line for the server log window (LogMsg, log_error, CFqDlg::Log).
void fq_log_line(const char* text);
