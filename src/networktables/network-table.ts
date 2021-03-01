import NetworkTableEntry from "./network-table-entry";
import NetworkTableInstance, { NetworkTableType, NT_PATH_SEPARATOR } from "./network-table-instance";

const normalizeRegex = new RegExp(`${NT_PATH_SEPARATOR}{2,}`, "g");

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

    // TODO Entry and subtable listeners

    public getSubTable(key: string): NetworkTable {
        return new NetworkTable(this._instance, this._pathWithSep + key);
    }

    public containsKey(key: string): boolean {
        throw new Error("Method not implemented");
        // TODO we need to modify NetworkTableEntry to let us know if it is "real"
    }

    public containsSubTable(key: string): boolean {
        throw new Error("Method not implemented");
        // TODO we need instance.getEntries() to be implemented
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
        throw new Error("Method not implemented");
        // TODO this.getEntry(key).delete();
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

    public equals(other: NetworkTable): boolean {
        if (other === this) {
            return true;
        }

        throw new Error("Method not implemented");
    }
}
