import { useRef, useState } from "react";
import { SettingsType } from "../struct";
import "./Settings.css";

interface Props {
    settings: SettingsType
    cancel: () => void
    save: (data: SettingsType) => void
}

function Settings(props: Props) {
    const [launch, setLaunch] = useState<string>(props.settings.launch == "" ? "" : props.settings.launch.slice(1));
    const [launchType, setLaunchType] = useState<string>(props.settings.launch.slice(0, 1));
    const fontRef = useRef<HTMLInputElement>(null);
    return (
        <div className="settings">
            <div className="container">
                <div style={{
                    width: '100%',
                    display: 'grid',
                    gridGap: '8px',
                    gridTemplateColumns: '160px auto',
                }}>
                    <label></label>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }} onChange={(event) => {
                        // let val = (event.target as HTMLInputElement).value;
                        // if (val == "borderless") {
                        //     setLaunchType("@");
                        // } else if (val == "default") {
                        //     setLaunchType("");
                        // } else if (val == "custom") {
                        //     setLaunchType("$");
                        // }
                    }}>
                        <input type="radio" checked={launchType == "@"} onChange={() => { setLaunchType("@"); }} name="launchType" value="borderless" id="launch-type-borderless"></input><label htmlFor="launch-type-borderless" style={{ flexGrow: 1, textAlign: 'start' }}>borderless</label>
                        <input type="radio" checked={launchType == ""} onChange={() => { setLaunchType(""); }} name="launchType" value="default" id="launch-type-default"></input><label htmlFor="launch-type-default" style={{ flexGrow: 1, textAlign: 'start' }}>system browser</label>
                        <input type="radio" checked={launchType == "$"} onChange={() => { setLaunchType("$"); }} name="launchType" value="custom" id="launch-type-custom"></input><label htmlFor="launch-type-custom" style={{ flexGrow: 1, textAlign: 'start' }}>custom</label>
                    </div>
                    <label className={launchType != "$" ? "disabled" : ""}>launch command</label>
                    <input disabled={launchType != "$"} value={launch} onInput={(event) => {
                        setLaunch(event.currentTarget.value);
                    }} />
                    <label>font family</label>
                    <input ref={fontRef} defaultValue={props.settings.fontFamily} />
                </div>
                <div className="button-group">
                    <div onClick={props.cancel}>cancel</div>
                    <div onClick={() => {
                        props.save({
                            launch: launchType == "$" ? (launchType + launch) : launchType,
                            fontFamily: fontRef.current?.value ?? "",
                        });
                    }}>save</div>
                </div>
            </div>
        </div>
    );
}

export default Settings;
