export class DataEvent<T> extends Event {
    data: T;
    id: number;
    constructor(type: string, id: number, data: T, eventInitDict?: EventInit) {
        super(type, eventInitDict);
        this.id = id;
        this.data = data;
    }
}

enum MsgType {
    auth = 0,
    new_session,
    close_session, // Send only
    term_data,
    fs_operation,
    info,
    resize = 0x0100,
}

enum SessionType {
    shell = 0,
    sftp = 1,
}

enum FSOP {
    getwd = 0, // [], string
    readdir, // [name], entry[]
    mkdir, // [name], boolean
    remove, // [name], boolean
    rename, // [old,new], boolean
    downloadFile, // [name], string
    uploadFile, // [path,name,<path>], boolean|string
}

export interface FSOPEventType {
    op: FSOP;
    data: string | DirEntry[] | string[];
}

export interface InfoType {
    type: string;
    info: string;
}

interface ConnectionEventMap {
    auth: DataEvent<string>;
    new_session: DataEvent<boolean>;
    term_data: DataEvent<ArrayBuffer>;
    fs_operation: DataEvent<FSOPEventType>;
    info: DataEvent<InfoType>;
}

interface ConnectionEventTarget extends EventTarget {
    addEventListener<K extends keyof ConnectionEventMap>(
        type: K,
        listener: (ev: ConnectionEventMap[K]) => void,
        options?: boolean | AddEventListenerOptions
    ): void;
    addEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: EventListenerOptions | boolean
    ): void;
}

const typedEventTarget = EventTarget as { new(): ConnectionEventTarget; prototype: ConnectionEventTarget };

export class Connection extends typedEventTarget {
    private socket: WebSocket;
    private protocol: 'standard' | 'goTTYd';
    private sessionTotal: number = 0;
    sessionCount: number = 0;
    sftphandles = new Map<number, FSHandle>();
    isWindowsPath = false;

    private disposer: () => void;

    constructor(url: string, protocol: 'standard' | 'goTTYd', callback: (ss: Connection) => void, dispose: () => void) {
        super();
        this.disposer = dispose;
        // console.log('construct', url);
        this.protocol = protocol;
        this.socket = new WebSocket(url);
        // this.socket.addEventListener('error', (e) => {
        //     console.log(e);
        // })
        this.socket.binaryType = "arraybuffer";
        this.socket.addEventListener('open', () => {
            callback(this);
        });
        this.socket.addEventListener('close', () => {
            this.dispatchEvent(new Event('close'));
        })
        if (protocol == 'goTTYd') {
            this.socket.addEventListener('message', this.ttyd_recv);
        } else {
            this.socket.addEventListener('message', this.std_recv);
        }
    }

    private ttyd_recv = (event: MessageEvent) => {
        this.dispatchEvent(new DataEvent<ArrayBuffer>(MsgType[MsgType.term_data], 0, event.data));
    }

    private decoder = new TextDecoder();
    private std_recv = (event: MessageEvent) => {
        let view = new Uint16Array(event.data.slice(0, 4));
        let messageType = view[0];
        let data = (event.data as ArrayBuffer).slice(4);
        switch (messageType) {
            case MsgType.auth:
                this.dispatchEvent(new DataEvent<string>(MsgType[MsgType.auth], view[1], this.decoder.decode(data)));
                break;
            case MsgType.new_session:
                if (new Uint8Array(data)[1] != 0) {
                    this.isWindowsPath = true;
                }
                let result = new Uint8Array(data)[0] != 0;
                this.dispatchEvent(new DataEvent<boolean>(MsgType[MsgType.new_session], view[1], result));
                if (!result) {
                    for (let [key, value] of this.sftphandles) {
                        if (value.ssid == view[1]) {
                            this.sftphandles.delete(key);
                            break;
                        }
                    }
                }
                break;
            case MsgType.term_data:
                this.dispatchEvent(new DataEvent<ArrayBuffer>(MsgType[MsgType.term_data], view[1], data));
                break;
            case MsgType.fs_operation:
                let op = new Uint8Array(data)[0];
                data = data.slice(1);
                this.dispatchEvent(new DataEvent<FSOPEventType>(MsgType[MsgType.fs_operation], view[1], {
                    op: op,
                    data: JSON.parse(this.decoder.decode(data)) as any,
                } as FSOPEventType));
                break;
            case MsgType.info:
                this.dispatchEvent(new DataEvent<InfoType>(MsgType[MsgType.info], view[1], JSON.parse(this.decoder.decode(data))));
                break;
            default:
        }
    }

    private encoder = new TextEncoder();
    private send(code: number, id: number, data: string | Uint8Array) {
        if (typeof data == 'string') {
            data = this.encoder.encode(data);
        }
        let buffer = new Uint8Array(4 + data.length);
        buffer.set(new Uint8Array(new Uint16Array([code, id]).buffer), 0);
        buffer.set(data, 4);
        this.socket.send(buffer);
    }

    close(id: number) {
        if (this.protocol == 'standard') {
            this.send(MsgType.close_session, id, "");
            if (this.sftphandles.has(id)) {
                this.send(MsgType.close_session, this.sftphandles.get(id)!.ssid, "");
                this.sessionTotal -= 1;
            }
        }
        this.sessionTotal -= 1;
        if (this.sessionTotal == 0) {
            this.socket.close();
            this.disposer();
        }
    }

    auth(question: string, password: string, saved: boolean) {
        if (this.protocol == 'standard') {
            this.send(MsgType.auth, 0, JSON.stringify({ question, password, saved }));
        }
    }

    newShell(): number {
        if (this.protocol == 'goTTYd') {
            if (this.sessionCount == 0) {
                this.sessionCount += 1;
                this.sessionTotal += 1;
                setTimeout(() => { this.dispatchEvent(new DataEvent<boolean>(MsgType[MsgType.new_session], 0, true)) }, 0);
                return 0;
            } else {
                setTimeout(() => { this.dispatchEvent(new DataEvent<boolean>(MsgType[MsgType.new_session], 0, false)) }, 0);
                return 0;
            }
        } else {
            this.send(MsgType.new_session, this.sessionCount, new Uint8Array([SessionType.shell, 0]));
            this.sessionCount += 1;
            this.sessionTotal += 1;
            return this.sessionCount - 1;
        }
    }

    newSftp(): number {
        this.send(MsgType.new_session, this.sessionCount, new Uint8Array([SessionType.sftp, 0]));
        this.sessionCount += 1;
        this.sessionTotal += 1;
        return this.sessionCount - 1;
    }

    termData(id: number, data: string | Uint8Array) {
        if (this.protocol == 'goTTYd') {
            this.send(1, 0, data);
        } else {
            this.send(MsgType.term_data, id, data);
        }
    }

    fsOperation(id: number, op: number, args: string[]) {
        this.send(MsgType.fs_operation, id, JSON.stringify({
            op,
            args,
        }));
    }

    resize(id: number, rows: number, cols: number) {
        if (this.protocol == 'goTTYd') {
            this.send(2, id, JSON.stringify({ rows, cols }));
        } else {
            this.send(MsgType.resize, id, JSON.stringify({ rows, cols }));
        }
    }
}

export interface DirEntry {
    name: string;
    dir: boolean;
    modTime: number;
    perm: number;
}

export class FSHandle {
    private getwdCallback?: (path: string) => void;
    private readdirCallback?: (entries: DirEntry[]) => void;
    private mkdirCallback?: (name: string) => void;
    private removeCallback?: (name: string) => void;
    private renameCallback?: (entries: string) => void;
    private uploadToCallback?: () => void;
    private uploadFileCallback?: (url: string) => void;

    constructor(public conn: Connection, public ssid: number) {
        this.conn.addEventListener("fs_operation", (event) => {
            if (event.id != this.ssid) {
                return;
            }
            switch (event.data.op) {
                case FSOP.getwd:
                    if (this.getwdCallback) {
                        this.getwdCallback(event.data.data as string);
                        this.getwdCallback = undefined;
                    }
                    break;
                case FSOP.readdir:
                    if (this.readdirCallback) {
                        this.readdirCallback(event.data.data as DirEntry[]);
                        this.readdirCallback = undefined;
                    }
                    break;
                case FSOP.mkdir:
                    if (this.mkdirCallback) {
                        this.mkdirCallback(event.data.data as string);
                        this.mkdirCallback = undefined;
                    }
                    break;
                case FSOP.remove:
                    if (this.removeCallback) {
                        this.removeCallback(event.data.data as string);
                        this.removeCallback = undefined;
                    }
                    break;
                case FSOP.rename:
                    if (this.renameCallback) {
                        this.renameCallback(event.data.data as string);
                        this.renameCallback = undefined;
                    }
                    break;
                case FSOP.downloadFile:
                    {
                        let info = event.data.data as string[];
                        let downloader = document.createElement("a");
                        downloader.style.display = "none";
                        downloader.href = "http://localhost:32300" + info[1];
                        downloader.download = info[0];
                        downloader.target = "_blank";
                        document.body.appendChild(downloader);
                        downloader.click();
                        document.body.removeChild(downloader);
                    }
                    break;
                case FSOP.uploadFile:
                    {
                        let info = event.data.data as string[];
                        if (info.length == 0) {
                            if (this.uploadToCallback) {
                                this.uploadToCallback();
                                this.uploadToCallback = undefined;
                            }
                        } else {
                            if (this.uploadFileCallback) {
                                this.uploadFileCallback(info[0]);
                                this.uploadFileCallback = undefined;
                            }
                        }
                    }
                    break
            }
        });
    }

    cwd = "";

    getwd(): Promise<string> {
        return new Promise((resolve) => {
            this.conn.fsOperation(this.ssid, FSOP.getwd, []);
            this.getwdCallback = resolve;
        });
    }

    readdir(name: string): Promise<DirEntry[]> {
        return new Promise((resolve) => {
            this.conn.fsOperation(this.ssid, FSOP.readdir, [name]);
            this.readdirCallback = resolve;
        });
    }

    mkdir(name: string): Promise<string> {
        return new Promise((resolve) => {
            this.conn.fsOperation(this.ssid, FSOP.mkdir, [name]);
            this.mkdirCallback = resolve;
        });
    }

    remove(name: string): Promise<string> {
        return new Promise((resolve) => {
            this.conn.fsOperation(this.ssid, FSOP.remove, [name]);
            this.removeCallback = resolve;
        });
    }

    rename(oldname: string, newname: string): Promise<string> {
        return new Promise((resolve) => {
            this.conn.fsOperation(this.ssid, FSOP.rename, [oldname, newname]);
            this.renameCallback = resolve;
        });
    }

    downloadFile(name: string) {
        this.conn.fsOperation(this.ssid, FSOP.downloadFile, [name]);
    }

    uploadTo(name: string): Promise<void> {
        return new Promise((resolve) => {
            this.conn.fsOperation(this.ssid, FSOP.uploadFile, [name, ""]);
            this.uploadToCallback = resolve;
        });
    }

    async uploadFile(name: string, file: File) {
        let url = await new Promise<string>((resolve) => {
            this.conn.fsOperation(this.ssid, FSOP.uploadFile, [name, "selected"]);
            this.uploadFileCallback = resolve;
        });
        if (url == "") {
            return;
        }
        let form = new FormData();
        form.append("file", file);
        await fetch("http://localhost:32300" + url, {
            method: 'POST',
            body: form,
        });
    }
}

export const connMan = new Map<number, Connection>();
