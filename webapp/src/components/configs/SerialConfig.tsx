import { ConfigSerial } from "../../struct";

interface Props {
    data?: ConfigSerial;
    onChange: (data: ConfigSerial) => void;
}

const inputStyle: React.CSSProperties = {
    color: 'white',
    border: '1px solid rgb(127 127 127 / 0.3)',
}

function SerialConfig(props: Props) {
    const data = Object.assign({
        type: "serial",
        name: "",
        serial: "",
        rate: 115200,
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
                <label>serial</label>
                <input style={inputStyle} value={data.serial} onInput={(event) => {
                    let ret = { ...data };
                    ret.serial = event.currentTarget.value;
                    props.onChange(ret);
                }} />
                <label>rate</label>
                <input style={inputStyle} value={data.rate} type="number" onInput={(event) => {
                    let ret = { ...data };
                    ret.rate = parseInt(event.currentTarget.value);
                    props.onChange(ret);
                }} />
            </div>
        </>
    )
}

export function checkSerial(data: ConfigSerial) {
    return data.serial != "" && data.rate > 0;
}

export function formatSerial(data: ConfigSerial): ConfigSerial {
    let ret = { ...data };
    ret.type = "serial";
    if (ret.name == "") {
        ret.name = ret.serial;
    }
    return ret;
}

export default SerialConfig;
