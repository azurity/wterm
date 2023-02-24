import { ConfigSSH } from "../../struct";

interface Props {
    data?: ConfigSSH;
    onChange: (data: ConfigSSH) => void;
}

const inputStyle: React.CSSProperties = {
    color: 'white',
    border: '1px solid rgb(127 127 127 / 0.3)',
}

function SSHConfig(props: Props) {
    const data = Object.assign({
        type: "ssh",
        name: "",
        termType: "xterm-256color",
        host: "",
        port: 22,
        username: "",
        password: "",
    }, props.data);
    return (
        <>
            <h4>SSH</h4>
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
                <label>term type</label>
                <input style={inputStyle} value={data.termType} onInput={(event) => {
                    let ret = { ...data };
                    ret.termType = event.currentTarget.value;
                    props.onChange(ret);
                }} />
                <label>host</label>
                <input style={inputStyle} value={data.host} onInput={(event) => {
                    let ret = { ...data };
                    ret.host = event.currentTarget.value;
                    props.onChange(ret);
                }} />
                <label>port</label>
                <input style={inputStyle} value={data.port} type="number" onInput={(event) => {
                    let ret = { ...data };
                    ret.port = Math.min(65535, Math.max(1, parseInt(event.currentTarget.value)));
                    props.onChange(ret);
                }} />
                <label>username</label>
                <input style={inputStyle} value={data.username} onInput={(event) => {
                    let ret = { ...data };
                    ret.username = event.currentTarget.value;
                    props.onChange(ret);
                }} />
                <label>password</label>
                <input style={inputStyle} value={data.password} onInput={(event) => {
                    let ret = { ...data };
                    ret.password = event.currentTarget.value;
                    props.onChange(ret);
                }} />
            </div>
        </>
    )
}

export function checkSSH(data: ConfigSSH) {
    return data.host != "" && data.port > 0 && data.port <= 65535;
}

export function formatSSH(data: ConfigSSH): ConfigSSH {
    let ret = { ...data };
    ret.type = "ssh";
    if (ret.name == "") {
        ret.name = ret.host;
    }
    return ret;
}

export default SSHConfig;
