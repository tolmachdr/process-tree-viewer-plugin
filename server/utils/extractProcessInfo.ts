export function extractProcessInfo(source: any): any {
  if (source.data?.audit) {
    const audit = source.data.audit;

    let fullCommand = audit.command;
    if (audit.execve) {
      const args: string[] = [];
      const argc = parseInt(audit.execve.argc || '0');

      for (let i = 0; i < argc; i++) {
        const argKey = `a${i}`;
        if (audit.execve[argKey]) {
          args.push(audit.execve[argKey]);
        }
      }

      if (args.length > 0) {
        fullCommand = args.join(' ');
      }
    }

    return {
      pid: parseInt(audit.pid) || 0,
      ppid: parseInt(audit.ppid) || 0,
      name: audit.exe ? audit.exe.split('/').pop() : audit.command?.split(' ')[0] || 'unknown',
      exe: audit.exe,
      command: fullCommand || audit.command,
      cwd: audit.cwd,
      uid: parseInt(audit.uid) || 0,
      gid: parseInt(audit.gid) || 0,
      type: 'audit',
      execve: audit.execve,
    };
  }

  if (source.data?.win?.eventdata) {
    const eventdata = source.data.win.eventdata;
    return {
      pid: parseInt(eventdata.processId) || 0,
      ppid: parseInt(eventdata.parentProcessId) || 0,
      name: eventdata.processName || eventdata.image || 'unknown',
      exe: eventdata.image,
      command: eventdata.commandLine,
      cwd: eventdata.currentDirectory,
      type: 'windows',
    };
  }

  if (source.data?.sysmon) {
    const sysmon = source.data.sysmon;
    return {
      pid: parseInt(sysmon.ProcessId) || 0,
      ppid: parseInt(sysmon.ParentProcessId) || 0,
      name: sysmon.ProcessName || sysmon.Image || 'unknown',
      exe: sysmon.Image,
      command: sysmon.CommandLine,
      cwd: sysmon.CurrentDirectory,
      type: 'sysmon',
    };
  }

  return {
    pid: parseInt(source.pid) || parseInt(source.processId) || 0,
    ppid: parseInt(source.ppid) || parseInt(source.parentProcessId) || 0,
    name: source.processName || source.exe?.split('/').pop() || 'unknown',
    exe: source.exe,
    command: source.commandLine || source.command,
    cwd: source.cwd,
    type: 'generic',
  };
}
