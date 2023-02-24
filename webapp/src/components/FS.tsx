import { useEffect, useRef, useState } from "react";
import { connMan, DirEntry, FSHandle } from "../connection";
import "./FS.css";
import { VscArrowUp, VscFile, VscFolder, VscFolderOpened, VscNewFile, VscNewFolder, VscRefresh } from 'react-icons/vsc';
import path from "path-browserify";
import Menu from "./Menu";

interface Props {
    connId: number;
    termId: number;
}

interface Position {
    x: number;
    y: number;
}

const permMap = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];

function accessPath(value: string) {
    return value == "/" ? "." : value.slice(1);
}

interface EntryItemProps {
    it: DirEntry;
    cwd: string;
    updateCwd: (path: string) => void;
    handle: FSHandle;
}

function EntryItem({ it, cwd, updateCwd, handle }: EntryItemProps) {

    let [menu, setMenu] = useState<boolean>(false);
    let [position, setPosition] = useState<Position>({ x: 0, y: 0 });

    useEffect(() => {
        document.addEventListener('contextmenu', (event) => {
            let elem = event.target;
            while (elem) {
                if (!(elem instanceof HTMLTableRowElement)) {
                    elem = (elem as HTMLElement).parentElement;
                } else {
                    break;
                }
            }
            if (!elem || (elem as HTMLElement).dataset['key'] != `file-${cwd}/${it.name}`) {
                setMenu(false);
            }
        });
        document.addEventListener('click', () => {
            setMenu(false);
        });
        window.addEventListener('resize', () => {
            setMenu(false);
        });
    }, []);


    const [renaming, setRenaming] = useState<boolean>(false);

    const renameFile = (oldname: string, newname: string) => {
        if (oldname == newname) {
            return;
        }
        oldname = path.normalize(path.resolve(cwd, oldname));
        newname = path.normalize(path.resolve(cwd, newname));
        handle.rename(accessPath(oldname), accessPath(newname)).then((msg: string) => {
            console.log(msg);
            if (msg == "") {
                updateCwd(cwd);
            }
        });
    }

    const deleteFile = (name: string) => {
        name = path.normalize(path.resolve(cwd, name));
        handle.remove(accessPath(name)).then((msg: string) => {
            console.log(msg);
            if (msg == "") {
                updateCwd(cwd);
            }
        });
    }

    return (
        <tr
            data-key={`file-${cwd}/${it.name}`}
            style={{
                cursor: it.dir ? 'pointer' : 'default',
            }}
            onDoubleClick={() => {
                if (it.dir) {
                    updateCwd(`${cwd}/${it.name}`);
                }
            }}
            onContextMenu={(event) => {
                setMenu(true);
                setPosition({ x: event.clientX, y: event.clientY });
                event.preventDefault();
            }}>
            <td style={{ position: 'relative' }}>
                {it.dir ? <VscFolderOpened /> : <span style={{ width: 16, height: 16, display: 'inline-block' }}></span>/*<VscFile />*/}
                <span style={{ paddingLeft: 4 }}>{it.name}</span>
                {menu ? <div className="menu" style={{ "--mouse-x": `${position.x}px`, "--mouse-y": `${position.y}px` } as any}>
                    <Menu style={{ width: 120 }} desc={[
                        {
                            title: 'rename',
                            action: () => { setRenaming(true); },
                        },
                        {
                            title: 'delete',
                            action: () => { deleteFile(it.name); },
                        },
                        {
                            title: 'download',
                            action: () => {
                                handle.downloadFile(accessPath(path.normalize(path.resolve(cwd, it.name))));
                            },
                        },
                    ]} />
                </div> : undefined}
                {renaming ? <input
                    autoFocus
                    style={{ background: 'black', position: 'absolute', width: 120, height: 16, top: -2, left: 0, color: 'white', border: '1px solid rgb(127 127 127 / 0.3)' }}
                    defaultValue={it.name}
                    onKeyDown={(event) => {
                        if (event.key == "Enter") {
                            if (event.currentTarget.value != "") {
                                renameFile(it.name, event.currentTarget.value);
                            }
                            setRenaming(false);
                        }
                    }}
                    onBlur={(event) => {
                        if (event.currentTarget.value != "") {
                            renameFile(it.name, event.currentTarget.value);
                        }
                        setRenaming(false);
                    }}
                /> : undefined}
            </td>
            <td>{new Date(it.modTime).toLocaleString()}</td>
            <td>{it.dir ? 'd' : '-'}
                {permMap[(it.perm & 0o700) >> 6]}
                {permMap[(it.perm & 0o070) >> 3]}
                {permMap[it.perm & 0o007]}
            </td>
        </tr>
    );
}

function FS(props: Props) {
    const [cwd, setCwd] = useState<string>("");
    const [cwdText, setCwdText] = useState<string>("");
    const [entries, setEntris] = useState<DirEntry[]>([]);
    const tableRef = useRef<HTMLPreElement>();

    const updateCwd = (value: string) => {
        value = path.normalize(path.resolve('/', value, '.'));
        handle.cwd = value;
        setCwd(value);
        setCwdText(value);
        handle.readdir(accessPath(value)).then((data) => {
            setEntris(data);
            tableRef.current?.scroll(0, 0);
        });
    }

    const [newfolder, setNewfolder] = useState<boolean>(false);

    const newfolderAction = (name: string) => {
        name = path.normalize(path.resolve(cwd, name));
        handle.mkdir(accessPath(name)).then((msg: string) => {
            console.log(msg);
            if (msg == "") {
                updateCwd(cwd);
            }
        });
    }

    const [dropping, setDropping] = useState<boolean>(false);

    if (props.connId < 0) {
        return <div></div>;
    }

    if (!connMan.get(props.connId)!.sftphandles.has(props.termId)) {
        return <div style={{
            padding: 8,
            boxSizing: 'border-box',
            width: '100%',
            height: '100%',
        }}>This session don't support file transport.</div>;
    }

    let handle = connMan.get(props.connId)!.sftphandles.get(props.termId)!;

    if (handle.cwd == "") {
        handle.getwd().then((value) => {
            handle.cwd = value;
            updateCwd(value);
        });
    } else if (cwd != handle.cwd) {
        updateCwd(handle.cwd);
    }

    return (
        <div
            className="fs"
            onDragEnter={(event) => {
                if (event.dataTransfer.items) {
                    if (event.dataTransfer.items[0].kind == 'file') {
                        setDropping(true);
                        event.preventDefault();
                    }
                }
            }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
            }}>
                <input style={{
                }}
                    value={cwdText}
                    onInput={(event) => {
                        setCwdText(event.currentTarget.value);
                    }}
                    onKeyDown={(event) => {
                        if (event.key == "Enter") {
                            updateCwd(event.currentTarget.value);
                        }
                    }}
                />
                <div className="button" onClick={() => {
                    updateCwd(`${cwd}/..`);
                }}><VscArrowUp /></div>
                <div className="button" onClick={() => {
                    updateCwd(cwd);
                }}><VscRefresh /></div>
            </div>
            <pre ref={(elem) => { tableRef.current = elem!; }}>
                <table>
                    <thead>
                        <tr>
                            <th>name</th>
                            <th>modified time</th>
                            <th>perm</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((it) => <EntryItem key={it.name} it={it} cwd={cwd} updateCwd={updateCwd} handle={handle} />)}
                    </tbody>
                </table>
                <div className="button"
                    onClick={() => {
                        setNewfolder(true);
                    }}><VscNewFolder /><span style={{ width: 120 }}>new folder</span>
                    {newfolder ? <input
                        autoFocus
                        style={{ background: 'black', position: "absolute", width: 'calc(100% - 6px)', height: 14, top: 0, left: 0, color: 'white', border: '1px solid rgb(127 127 127 / 0.3)' }}
                        onKeyDown={(event) => {
                            if (event.key == "Enter") {
                                if (event.currentTarget.value != "") {
                                    newfolderAction(event.currentTarget.value);
                                }
                                setNewfolder(false);
                            }
                        }}
                        onBlur={(event) => {
                            if (event.currentTarget.value != "") {
                                newfolderAction(event.currentTarget.value);
                            }
                            setNewfolder(false);
                        }}
                    /> : undefined}
                </div>
                <div
                    className="button"
                    onClick={() => {
                        handle.uploadTo(accessPath(cwd)).then(() => {
                            updateCwd(cwd);
                        });
                    }}><VscNewFile /><span style={{ width: 120 }}>upload file</span></div>
            </pre>
            {dropping ?
                <div
                    className="overlay"
                    onDragOver={(event) => {
                        if (event.dataTransfer.items) {
                            if (event.dataTransfer.items[0].kind == 'file') {
                                event.preventDefault();
                            }
                        }
                    }}
                    onDragLeave={(event) => {
                        if (event.dataTransfer.items) {
                            if (event.dataTransfer.items[0].kind == 'file') {
                                setDropping(false);
                                event.preventDefault();
                            }
                        }
                    }}
                    onDrop={async (event) => {
                        event.preventDefault();
                        if (event.dataTransfer.items) {
                            for (let it of event.dataTransfer.items) {
                                if (it.kind == 'file') {
                                    let file = it.getAsFile();
                                    await handle.uploadFile(accessPath(path.normalize(path.resolve(cwd, file!.name))), file!);
                                }
                            }
                        }
                        setDropping(false);
                        updateCwd(cwd);
                    }}>drop to upload</div> : undefined}
        </div>
    );
}

export default FS;
