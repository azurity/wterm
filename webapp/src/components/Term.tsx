import React from 'react'
import { Terminal, ITerminalOptions, ITerminalInitOnlyOptions } from 'xterm'
import { FitAddon } from 'xterm-addon-fit';
import { Unicode11Addon } from 'xterm-addon-unicode11';
import 'xterm/css/xterm.css'
import { connMan } from '../connection';

interface Props {
    connId: number;
    dispose: () => void;
    created?: () => void;
    options?: ITerminalOptions & ITerminalInitOnlyOptions;
}

class Term extends React.Component<Props> {
    connId: number;
    ssId: number;
    terminalRef: React.RefObject<HTMLDivElement>;
    terminal: Terminal;
    fitAddon = new FitAddon();
    unicode11Addon = new Unicode11Addon();
    disposer: () => void;
    created: () => void;

    // finalReg = new FinalizationRegistry((ssid: number) => {
    //     if (ssid >= 0) {
    //         console.log('unreg');
    //         manager.del(ssid);
    //     }
    // })
    constructor(props: Props) {
        super(props);
        this.disposer = props.dispose;
        this.created = props.created ?? (() => { });
        this.terminalRef = React.createRef();
        this.terminal = new Terminal(props.options ?? { allowProposedApi: true });
        this.terminal.loadAddon(this.fitAddon);
        this.terminal.loadAddon(this.unicode11Addon);
        this.connId = props.connId;
        this.ssId = -1;
    }

    componentDidMount(): void {
        if (this.ssId < 0) {
            let conn = connMan.get(this.connId);
            if (!conn) {
                return;
            }
            this.ssId = conn.newShell();
            conn.addEventListener("new_session", (event) => {
                if (event.id != this.ssId) {
                    return;
                }
                if (!event.data) {
                    this.ssId = -1;
                    this.disposer();
                    return;
                }
                this.created();
                this.terminal.open(this.terminalRef.current!);
                this.fitAddon.fit();
                conn?.resize(this.ssId, this.terminal.rows, this.terminal.cols); // ?
            });
            conn.addEventListener("term_data", (event) => {
                if (event.id != this.ssId) {
                    return;
                }
                this.terminal.write(new Uint8Array(event.data));
            });
            this.terminal.onData((data) => {
                conn?.termData(this.ssId, data);
            });
            this.terminal.onBinary((data) => {
                let buffer = new Uint8Array(data.length);
                for (let i = 0; i < data.length; i++) {
                    buffer[i + 4] = data.charCodeAt(i);
                }
                conn?.termData(this.ssId, buffer);
            });
            this.terminal.onResize(({ rows, cols }) => {
                // console.log(rows, cols);
                conn?.resize(this.ssId, rows, cols);
            });
        }
    }

    dispose(): void {
        console.log('dispose');
        if (this.ssId >= 0) {
            connMan.get(this.connId)?.close(this.ssId);
            this.ssId = -1;
        }
    }

    resizeHandle: number = 0;
    resize() {
        if (this.resizeHandle != 0) {
            clearTimeout(this.resizeHandle);
        }
        setTimeout(() => {
            this.fitAddon.fit();
        }, 100);
    }

    render(): React.ReactNode {
        return <div ref={this.terminalRef} style={{ height: '100%', background: 'black', boxSizing: 'border-box', padding: 8, paddingRight: 0 }}></div>
    }
}

export default Term;
