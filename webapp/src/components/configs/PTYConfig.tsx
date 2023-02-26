import shlex from 'shlex';
import { ConfigPTY } from "../../struct";

interface Props {
    data?: ConfigPTY & { cache: string };
    onChange: (data: ConfigPTY & { cache: string }) => void;
}

const inputStyle: React.CSSProperties = {
    color: 'white',
    border: '1px solid rgb(127 127 127 / 0.3)',
}

function PTYConfig(props: Props) {
    let data = Object.assign({
        type: "PTY",
        name: "",
        cmd: [],
        termType: 'xterm-256color',
        cache: null as (string | null),
    }, props.data);
    if (data.cache == null) {
        data.cache = shlex.join(data.cmd);
    }
    return (
        <>
            <h4>PTY</h4>
            <div style={{
                width: '100%',
                display: 'grid',
                gridGap: '8px',
                gridTemplateColumns: '120px auto',
            }}>
                <label>name</label>
                <input style={inputStyle} value={data.name} onInput={(event) => {
                    let ret = { ...data };
                    ret.name = event.currentTarget.value;
                    props.onChange(ret);
                }} />
                <label>shell command</label>
                <input style={inputStyle} value={data.cache} onInput={(event) => {
                    let ret = { ...data };
                    ret.cache = event.currentTarget.value;
                    props.onChange(ret);
                }} />
                <label>term type</label>
                <input style={inputStyle} value={data.termType} onInput={(event) => {
                    let ret = { ...data };
                    ret.termType = event.currentTarget.value;
                    props.onChange(ret);
                }} />
            </div>
        </>
    )
}

export function checkPTY(data: ConfigPTY & { cache: string }) {
    return data.cache != "";
}

export function formatPTY(data: ConfigPTY & { cache: string }): ConfigPTY {
    let ret: ConfigPTY & { cache?: string } = { ...data };
    ret.type = "PTY";
    ret.cmd = shlex.split(ret.cache!);
    if (ret.name == "") {
        ret.name = ret.cmd[0];
    }
    ret.cache = undefined;
    return ret;
}

export default PTYConfig;
