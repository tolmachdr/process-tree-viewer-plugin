import { extractProcessInfo } from './extractProcessInfo';

describe('extractProcessInfo', () => {
  // ---------------------------------------------------------------------------
  // Linux auditd — data.audit
  // ---------------------------------------------------------------------------
  describe('audit source (data.audit)', () => {
    it('extracts all core fields from audit data', () => {
      const source = {
        data: {
          audit: {
            pid: '1234',
            ppid: '1',
            exe: '/usr/bin/bash',
            command: 'bash',
            cwd: '/home/user',
            uid: '1000',
            gid: '2000',
          },
        },
      };
      const result = extractProcessInfo(source);

      expect(result.pid).toBe(1234);
      expect(result.ppid).toBe(1);
      expect(result.exe).toBe('/usr/bin/bash');
      expect(result.name).toBe('bash'); // basename of exe
      expect(result.cwd).toBe('/home/user');
      expect(result.uid).toBe(1000);
      expect(result.gid).toBe(2000);
      expect(result.type).toBe('audit');
    });

    it('uses basename of exe as the process name', () => {
      const source = {
        data: { audit: { pid: '1', ppid: '0', exe: '/usr/sbin/sshd' } },
      };
      expect(extractProcessInfo(source).name).toBe('sshd');
    });

    it('falls back to first word of command when exe is absent', () => {
      const source = {
        data: { audit: { pid: '1', ppid: '0', command: 'python3 script.py' } },
      };
      expect(extractProcessInfo(source).name).toBe('python3');
    });

    it('returns "unknown" when neither exe nor command is present', () => {
      const source = {
        data: { audit: { pid: '1', ppid: '0' } },
      };
      expect(extractProcessInfo(source).name).toBe('unknown');
    });

    it('reconstructs the command string from execve arguments', () => {
      const source = {
        data: {
          audit: {
            pid: '1',
            ppid: '0',
            exe: '/usr/bin/ls',
            execve: { argc: '3', a0: 'ls', a1: '-la', a2: '/home' },
          },
        },
      };
      expect(extractProcessInfo(source).command).toBe('ls -la /home');
    });

    it('uses original command when execve argc=0', () => {
      const source = {
        data: {
          audit: {
            pid: '1',
            ppid: '0',
            command: 'original-command',
            execve: { argc: '0' },
          },
        },
      };
      expect(extractProcessInfo(source).command).toBe('original-command');
    });

    it('returns single-word command when argc=1', () => {
      const source = {
        data: {
          audit: {
            pid: '1',
            ppid: '0',
            execve: { argc: '1', a0: 'bash' },
          },
        },
      };
      expect(extractProcessInfo(source).command).toBe('bash');
    });

    it('attaches the execve object to the result', () => {
      const execve = { argc: '1', a0: 'bash' };
      const source = {
        data: { audit: { pid: '1', ppid: '0', execve } },
      };
      expect(extractProcessInfo(source).execve).toBe(execve);
    });

    it('parses pid and ppid as numbers', () => {
      const source = {
        data: { audit: { pid: '42', ppid: '7' } },
      };
      const result = extractProcessInfo(source);

      expect(typeof result.pid).toBe('number');
      expect(typeof result.ppid).toBe('number');
    });
  });

  // ---------------------------------------------------------------------------
  // Windows — data.win.eventdata
  // ---------------------------------------------------------------------------
  describe('windows source (data.win.eventdata)', () => {
    it('extracts all fields from eventdata', () => {
      const source = {
        data: {
          win: {
            eventdata: {
              processId: '4',
              parentProcessId: '1',
              processName: 'cmd.exe',
              image: 'C:\\Windows\\System32\\cmd.exe',
              commandLine: 'cmd.exe /c dir',
              currentDirectory: 'C:\\',
            },
          },
        },
      };
      const result = extractProcessInfo(source);

      expect(result.pid).toBe(4);
      expect(result.ppid).toBe(1);
      expect(result.name).toBe('cmd.exe');
      expect(result.exe).toBe('C:\\Windows\\System32\\cmd.exe');
      expect(result.command).toBe('cmd.exe /c dir');
      expect(result.cwd).toBe('C:\\');
      expect(result.type).toBe('windows');
    });

    it('falls back to image when processName is missing', () => {
      const source = {
        data: {
          win: {
            eventdata: { processId: '4', parentProcessId: '1', image: 'explorer.exe' },
          },
        },
      };
      expect(extractProcessInfo(source).name).toBe('explorer.exe');
    });

    it('returns "unknown" when both processName and image are absent', () => {
      const source = {
        data: {
          win: { eventdata: { processId: '4', parentProcessId: '1' } },
        },
      };
      expect(extractProcessInfo(source).name).toBe('unknown');
    });
  });

  // ---------------------------------------------------------------------------
  // Sysmon — data.sysmon
  // ---------------------------------------------------------------------------
  describe('sysmon source (data.sysmon)', () => {
    it('extracts all fields from sysmon data', () => {
      const source = {
        data: {
          sysmon: {
            ProcessId: '100',
            ParentProcessId: '50',
            ProcessName: 'powershell.exe',
            Image: 'C:\\Windows\\System32\\powershell.exe',
            CommandLine: 'powershell -ExecutionPolicy Bypass',
            CurrentDirectory: 'C:\\Users\\Admin',
          },
        },
      };
      const result = extractProcessInfo(source);

      expect(result.pid).toBe(100);
      expect(result.ppid).toBe(50);
      expect(result.name).toBe('powershell.exe');
      expect(result.exe).toBe('C:\\Windows\\System32\\powershell.exe');
      expect(result.command).toBe('powershell -ExecutionPolicy Bypass');
      expect(result.cwd).toBe('C:\\Users\\Admin');
      expect(result.type).toBe('sysmon');
    });

    it('falls back to Image when ProcessName is missing', () => {
      const source = {
        data: {
          sysmon: { ProcessId: '1', ParentProcessId: '0', Image: 'notepad.exe' },
        },
      };
      expect(extractProcessInfo(source).name).toBe('notepad.exe');
    });
  });

  // ---------------------------------------------------------------------------
  // Generic / fallback
  // ---------------------------------------------------------------------------
  describe('generic fallback source', () => {
    it('extracts fields from a flat generic structure', () => {
      const source = {
        pid: '42',
        ppid: '1',
        processName: 'myapp',
        exe: '/usr/local/bin/myapp',
        commandLine: 'myapp --verbose',
        cwd: '/var/run',
      };
      const result = extractProcessInfo(source);

      expect(result.pid).toBe(42);
      expect(result.ppid).toBe(1);
      expect(result.name).toBe('myapp');
      expect(result.type).toBe('generic');
    });

    it('uses processId when pid is absent', () => {
      const source = { processId: '99', parentProcessId: '1' };
      const result = extractProcessInfo(source);

      expect(result.pid).toBe(99);
      expect(result.ppid).toBe(1);
    });

    it('uses basename of exe when processName is absent', () => {
      const source = { pid: '5', ppid: '1', exe: '/usr/bin/curl' };
      expect(extractProcessInfo(source).name).toBe('curl');
    });

    it('returns "unknown" when no name can be determined', () => {
      expect(extractProcessInfo({}).name).toBe('unknown');
    });

    it('returns pid=0 when the value cannot be parsed as a number', () => {
      expect(extractProcessInfo({ pid: 'notanumber' }).pid).toBe(0);
    });

    it('returns ppid=0 when the value cannot be parsed as a number', () => {
      expect(extractProcessInfo({ pid: '1', ppid: 'bad' }).ppid).toBe(0);
    });

    it('uses command when commandLine is absent', () => {
      const source = { pid: '1', command: 'myapp arg1' };
      expect(extractProcessInfo(source).command).toBe('myapp arg1');
    });
  });

  // ---------------------------------------------------------------------------
  // Source priority: audit > windows > sysmon > generic
  // ---------------------------------------------------------------------------
  describe('source priority', () => {
    it('audit data takes priority over generic top-level fields', () => {
      const source = {
        pid: '999',
        data: { audit: { pid: '123', ppid: '1' } },
      };
      expect(extractProcessInfo(source).pid).toBe(123);
    });

    it('windows eventdata takes priority over generic top-level fields', () => {
      const source = {
        pid: '999',
        data: {
          win: { eventdata: { processId: '456', parentProcessId: '1' } },
        },
      };
      expect(extractProcessInfo(source).pid).toBe(456);
    });
  });
});
