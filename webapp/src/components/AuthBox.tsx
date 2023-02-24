import { useState } from "react";

interface Props {
    secret: boolean
    submit: (password: string) => void;
    cancel: () => void;
}

const buttonGroupStyle: React.CSSProperties = {
    textAlign: 'center',
    userSelect: 'none',
    position: 'absolute',
    right: '16px',
    bottom: '16px',
    display: 'flex',
    flexDirection: 'row',
    gap: '16px',
}

const buttonStyle: React.CSSProperties = {
    width: '60px',
    height: '24px',
    cursor: 'pointer',
    border: '1px solid rgb(127 127 127 / 0.3)',
}

function AuthBox(props: Props) {
    const [value, setValue] = useState<string>("");

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <input
                type={props.secret ? 'password' : 'text'}
                style={{ width: '50%', minWidth: '120px', maxWidth: '400px', color: 'white', border: '1px solid rgb(127 127 127 / 0.3)' }}
                placeholder="input here"
                value={value}
                onChange={(event) => {
                    setValue(event.target.value);
                }}></input>
            <div style={buttonGroupStyle}>
                <div
                    style={buttonStyle}
                    onClick={() => {
                        props.cancel();
                    }}>cancel</div>
                <div
                    style={buttonStyle}
                    onClick={() => {
                        props.submit(value);
                    }}>sure</div>
            </div>
        </div>
    )
}

export default AuthBox;
