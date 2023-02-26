export interface SessionInfo {
    id: number;
    name: string;
    url: string;
    protocol: 'goTTYd' | 'standard';
}

export interface ConfigBase {
    type: string;
    name: string;
}

export type ConfigPTY = ConfigBase & {
    cmd: string[];
    termType: string;
}

export type ConfigSSH = ConfigBase & {
    termType: string;
    host: string;
    port: number;
    username: string;
    password: string;
}

export interface StatusItem {
    type: 'INFO' | 'ERROR';
    time: number;
    info: string;
}

export interface SettingsType {
    launch: string;
    fontFamily: string;
}
