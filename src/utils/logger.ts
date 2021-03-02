export enum LogSeverity {
    FATAL = 0,
    ERROR = 1,
    WARNING = 2,
    INFO = 3,
    DEBUG = 4
}

function SeverityToString(sev: LogSeverity): string {
    switch(sev) {
        case LogSeverity.DEBUG:
            return "DEBUG: ";
        case LogSeverity.INFO:
            return "INFO: ";
        case LogSeverity.WARNING:
            return "WARN: ";
        case LogSeverity.ERROR:
            return "ERROR: ";
        case LogSeverity.FATAL:
            return "FATAL: ";
    }
}

export default class Logger {
    private _severity: LogSeverity = LogSeverity.WARNING;
    private _ident: string;

    constructor(ident: string) {
        this._ident = ident;
    }

    public get severity(): LogSeverity {
        return this._severity;
    }

    public set severity(val: LogSeverity) {
        this._severity = val;
    }

    public log(level: LogSeverity, ...args: any[]) {
        if (level <= this._severity) {
            console.log(`[${this._ident}] ${SeverityToString(level)}`, ...args);
        }
    }

    public debug(...args: any[]) {
        this.log(LogSeverity.DEBUG, ...args);
    }

    public info(...args: any[]) {
        this.log(LogSeverity.INFO, ...args);
    }

    public warn(...args: any[]) {
        this.log(LogSeverity.WARNING, ...args);
    }

    public error(...args: any[]) {
        this.log(LogSeverity.ERROR, ...args);
    }

    public fatal(...args: any[]) {
        this.log(LogSeverity.FATAL, ...args);
    }
}
