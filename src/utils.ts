import * as fs from 'fs';
import { URL } from 'url';
import glob from 'glob';
import proxy from 'https-proxy-agent';
import { ScriptTarget } from 'typescript';
import { CommandOptions, defaultConfigFile } from './commandOptions';
import { Config } from './core/config';

export function readStream(
    stream: NodeJS.ReadableStream,
    encoding: BufferEncoding = 'utf8'
): Promise<string> {
    stream.setEncoding(encoding);
    return new Promise((resolve, reject) => {
        let data = '';
        stream.on('data', (chunk) => (data += chunk));
        stream.on('end', () => resolve(data));
        stream.on('error', (error) => reject(error));
    });
}

export async function readUrl(url: string): Promise<string> {
    const init = buildProxyOptions(url);
    const res = await fetch(url, init);
    const data = await res.text();
    if (!res.ok) {
        throw new Error(
            `Error on fetch from url(${url}): ${res.status}, ${data}`
        );
    }
    return data;
}
function noProxy(url: URL): boolean {
    if (process.env.NO_PROXY) {
        for (const domain of process.env.NO_PROXY.split(/[, ]+/)) {
            if (url.hostname.endsWith(domain)) {
                return true;
            }
        }
    }
    return false;
}
export function buildProxyOptions(url: string): RequestInit | undefined {
    const parsedUrl = new URL(url);
    let proxyUrl;
    if (!noProxy(parsedUrl)) {
        if (parsedUrl.protocol === 'http:' && process.env.HTTP_PROXY) {
            proxyUrl = new URL(process.env.HTTP_PROXY);
        } else if (parsedUrl.protocol === 'https:' && process.env.HTTPS_PROXY) {
            proxyUrl = new URL(process.env.HTTPS_PROXY);
        }
    }
    if (proxyUrl) {
        const agentOptions: proxy.HttpsProxyAgentOptions = {};
        agentOptions.protocol = proxyUrl.protocol;
        agentOptions.host = proxyUrl.hostname;
        agentOptions.port = proxyUrl.port;
        if (proxyUrl.username) {
            agentOptions.auth = proxyUrl.username + ':' + proxyUrl.password;
        }
        return { agent: proxy(agentOptions) } as RequestInit;
    }
    return undefined;
}

export function globFiles(
    pattern: string,
    options?: glob.IOptions
): Promise<string[]> {
    return new Promise((resolve, reject) => {
        glob(pattern, options ?? {}, (err, matches) => {
            if (err) {
                reject(err);
            } else {
                resolve(matches);
            }
        });
    });
}

export function readConfig(options: CommandOptions): Partial<Config> {
    let pc: Partial<Config> = {};
    const configFile = options.configFile ?? defaultConfigFile;
    try {
        pc = loadJSON(configFile);
        pc.configFile = configFile;
    } catch (err) {
        if (options.configFile != null) {
            console.error(
                'Error to load config file from ' + options.configFile
            );
        }
    }

    if (pc.input == null) {
        pc.input = {
            files: [],
            urls: [],
            stdin: false,
        };
    }
    if (options.files.length > 0) {
        pc.input.files = options.files;
    } else if (pc.input.files == null) {
        pc.input.files = [];
    }
    if (options.urls.length > 0) {
        pc.input.urls = options.urls;
    } else if (pc.input.urls == null) {
        pc.input.urls = [];
    }
    pc.input.stdin = options.isReadFromStdin();

    if (options.out != null) {
        pc.outputFile = options.out;
    }
    if (options.target != null) {
        pc.target = convertToScriptTarget(options.target);
    } else if (pc.target != null) {
        pc.target = convertToScriptTarget(pc.target as unknown as string);
    }
    pc.outputAST = !!options.outputAST;
    return pc;
}
function loadJSON(file: string): Partial<Config> {
    const content = fs.readFileSync(file, 'utf-8');
    return JSON.parse(content) as Partial<Config>;
}
function convertToScriptTarget(target: string): ScriptTarget {
    switch (target.trim().toLowerCase()) {
        case 'es3':
            return ScriptTarget.ES3;
        case 'es5':
            return ScriptTarget.ES5;
        case 'es2015':
            return ScriptTarget.ES2015;
        case 'es2016':
            return ScriptTarget.ES2016;
        case 'es2017':
            return ScriptTarget.ES2017;
        case 'es2018':
            return ScriptTarget.ES2018;
        case 'es2019':
            return ScriptTarget.ES2019;
        case 'es2020':
            return ScriptTarget.ES2020;
        case 'esnext':
            return ScriptTarget.ESNext;
        default:
            return ScriptTarget.Latest;
    }
}
