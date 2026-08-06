Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)

WshShell.CurrentDirectory = strPath

' Run Start-KumonSISO-Windows.cmd silently (0 = hidden window)
WshShell.Run "cmd /c Start-KumonSISO-Windows.cmd", 0, False
