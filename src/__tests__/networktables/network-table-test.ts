import NetworkTable from "../../networktables/network-table";

describe("Network Tables", () => {
    describe("Static Methods", () => {
        it("basenameKey test", () => {
            expect(NetworkTable.basenameKey("/foo/bar/baz")).toEqual("baz");
            expect(NetworkTable.basenameKey("/foo/bar/baz/")).toEqual("");
        });

        it("normalizeKey test", () => {
            expect(NetworkTable.normalizeKey("/foo/bar", true)).toEqual("/foo/bar");
            expect(NetworkTable.normalizeKey("foo/bar", true)).toEqual("/foo/bar");
            expect(NetworkTable.normalizeKey("/foo/bar", false)).toEqual("foo/bar");
            expect(NetworkTable.normalizeKey("/foo///bar", false)).toEqual("foo/bar");
            expect(NetworkTable.normalizeKey("foo/bar")).toEqual("/foo/bar");
        });

        it("getHierarchy test", () => {
            expect(NetworkTable.getHierarchy("foo/bar/baz")).toEqual(["/", "/foo", "/foo/bar", "/foo/bar/baz"])
        });
    });

    describe("Construction", () => {
        it("should normalize the key upon construction", () => {
            const table1 = new NetworkTable(undefined, "foo/bar");
            expect(table1.getPath()).toEqual("/foo/bar");

            const table2 = table1.getSubTable("/baz");
            expect(table2.getPath()).toEqual("/foo/bar/baz");
        });
    })
});
