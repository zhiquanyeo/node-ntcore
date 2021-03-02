import NetworkTableEntry from "./network-table-entry";
import NetworkTableInstance, { EntryListenerFlags, NetworkTableType } from "./network-table-instance";
import NetworkTableValue from "./network-table-value";

const NT_PATH_SEPARATOR = "/";
const normalizeRegex = new RegExp(`${NT_PATH_SEPARATOR}{2,}`, "g");

export type TableEntryListener = (table: NetworkTable, key: string, entry: NetworkTableEntry, value: NetworkTableValue, flags: EntryListenerFlags) => void;
export type TableCreationListener = (parent: NetworkTable, name: string, table: NetworkTable) => void;

export default class NetworkTable {
    // STATIC METHODS AND PROPERTIES

    /**
     * Gets the base name of a key. e.g. "/foo/bar" becomes "bar".
     * If the key has a trailing slash, returns an empty string
     * @param key
     */
    public static basenameKey(key: string): string {
        const lastSepIdx = key.lastIndexOf(NT_PATH_SEPARATOR);
        if (lastSepIdx === -1) {
            return key;
        }

        return key.substring(lastSepIdx + 1);
    }

    /**
     * Normalizes a key by removing consecutive slashes and optionally starting
     * with a leading slash. E.g.
     *
     * normalizeKey("/foo/bar", true) => "/foo/bar"
     * normalizeKey("foo/bar", true) => "/foo/bar"
     * normalizeKey("/foo/bar", false) => "foo/bar"
     * normalizeKey("foo//bar", false) => "foo/bar"
     * @param key
     * @param withLeadingSlash whether or not the normalized key should begin with a leading slash
     */
    public static normalizeKey(key: string, withLeadingSlash: boolean = true): string {
        let normalized: string = "";
        if (withLeadingSlash) {
            normalized = NT_PATH_SEPARATOR + key;
        }
        else {
            normalized = key;
        }
        normalized = normalized.replace(normalizeRegex, NT_PATH_SEPARATOR);

        if (!withLeadingSlash && normalized.charAt(0) === NT_PATH_SEPARATOR) {
            normalized = normalized.substring(1);
        }

        return normalized;
    }

    /**
     * Gets a list of all the super tables of a given key.
     * E.g. the key "/foo/bar/baz" has hierarchy of "/", "/foo", "/foo/bar", "/foo/bar/baz"
     * @param key
     */
    public static getHierarchy(key: string): string[] {
        const normalized = this.normalizeKey(key, true);
        const result: string[] = [];

        if (normalized.length === 1) {
            result.push(normalized);
            return result;
        }

        for (let i = 1; ; i = normalized.indexOf(NT_PATH_SEPARATOR, i + 1)) {
            if (i === -1) {
                result.push(normalized);
                break;
            }
            else {
                result.push(normalized.substring(0, i));
            }
        }

        return result;
    }


    // INSTANCE METHODS AND PROPERTIES
    private _path: string;
    private _pathWithSep: string;
    private _instance: NetworkTableInstance;

    private _entries: Map<string, NetworkTableEntry> = new Map<string, NetworkTableEntry>();

    constructor(instance: NetworkTableInstance, path: string) {
        this._instance = instance;
        this._path = NetworkTable.normalizeKey(path) ;
        this._pathWithSep = path + NT_PATH_SEPARATOR;
    }

    public toString(): string {
        return `NetworkTable: ${this._path}`;
    }

    /**
     * Get the entry for a sub key
     * @param key
     */
    public getEntry(key: string): NetworkTableEntry {
        let entry = this._entries.get(key);

        if (!entry) {
            entry = this._instance.getEntry(this._pathWithSep + key);
            this._entries.set(key, entry);
        }

        return entry;
    }

    public addEntryListener(key: string | null, listener: TableEntryListener, listenerFlags: EntryListenerFlags): string {
        if (key !== null) {
            const entry = this.getEntry(key);
            return this._instance.addEntryListener(entry,
                (key, entry, value, flags) => {
                    listener(this, key, entry, value, flags);
                }, listenerFlags);
        }

        const prefixLen = this._path.length + 1;
        return this._instance.addEntryListener(this._path,
            (key, entry, value, flags) => {
                const relativeKey = key.substring(prefixLen);
                if (relativeKey.indexOf(NT_PATH_SEPARATOR) !== -1) {
                    // Part of a sub table, ignore
                    return;
                }

                listener(this, relativeKey, entry, value, flags);
            },
            listenerFlags);
    }

    public removeEntryListener(guid: string) {
        this._instance.removeEntryListener(guid);
    }

    public addSubTableListener(listener: TableCreationListener, localNotify: boolean) {
        let flags = EntryListenerFlags.NEW | EntryListenerFlags.IMMEDIATE;

        if (localNotify) {
            flags |= EntryListenerFlags.LOCAL;
        }

        const prefixLen = this._path.length + 1;
        const parent: NetworkTable = this;

        const notifiedTables = new Set<string>();
        return this._instance.addEntryListener(this._pathWithSep,
            (key, entry, value, flags) => {
                const relativeKey = key.substring(prefixLen);
                const endSubTable = relativeKey.indexOf(NT_PATH_SEPARATOR);
                if (endSubTable === -1) {
                    return;
                }

                const subTableKey = relativeKey.substring(0, endSubTable);
                if (notifiedTables.has(subTableKey)) {
                    return;
                }
                notifiedTables.add(subTableKey);

                listener(parent, subTableKey, parent.getSubTable(subTableKey));

            }, flags);
    }

    public removeSubTableListener(guid: string) {
        this._instance.removeEntryListener(guid);
    }

    public getSubTable(key: string): NetworkTable {
        return new NetworkTable(this._instance, this._pathWithSep + key);
    }

    public containsKey(key: string): boolean {
        return this.getEntry(key).exists();
    }

    public containsSubTable(key: string): boolean {
        const entries = this._instance.getEntries(this._pathWithSep + key + NT_PATH_SEPARATOR, NetworkTableType.UNASSIGNED);
        return entries.length !== 0;
    }

    public getKeys(types: NetworkTableType = NetworkTableType.UNASSIGNED): Set<string> {
        const keys = new Set<string>();

        const prefixLen = this._path.length + 1;

        const entries = this._instance.getEntries(this._pathWithSep, types);
        entries.forEach(entry => {
            const relativeKey = entry.getName().substring(prefixLen);
            if (relativeKey.indexOf(NT_PATH_SEPARATOR) !== -1) {
                return;
            }

            keys.add(relativeKey);

            // Populate the entries as we go along
            if (!this._entries.has(relativeKey)) {
                this._entries.set(relativeKey, entry);
            }
        });

        return keys;
    }

    public getSubTables(): Set<string> {
        const keys = new Set<string>();
        const prefixLen = this._path.length + 1;

        const entries = this._instance.getEntries(this._pathWithSep, NetworkTableType.UNASSIGNED);
        entries.forEach(entry => {
            const relativeKey = entry.getName().substring(prefixLen);
            const endSubTable = relativeKey.indexOf(NT_PATH_SEPARATOR);
            if (endSubTable === -1) {
                return;
            }

            keys.add(relativeKey.substring(0, endSubTable));
        });

        return keys;
    }

    public delete(key: string): void {
        this.getEntry(key).delete();
    }

    public getPath(): string {
        return this._path;
    }

    public saveEntries(filename: string): void {
        throw new Error("Method Not Implemented");
    }

    public loadEntries(filename: string): string[] {
        throw new Error("Method not implemented");
    }
}
