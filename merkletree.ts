import { StandardMerkleTree } from "@openzeppelin/merkle-tree"

export const rawTree = {
  format: "standard-v1" as const,
  tree: [
    "0x18936852e39edc09b19c2e281ba3887e91259de233b7a47ca122d185000e6124",
    "0xba1872253c7519232843b5a162f2892aa0117d55f10376955554838e892214a4",
    "0x8cfffaf7e5b8afa807fb9908f3c3d9c2c94f92131d8917b8b7084cd154660367",
  ],
  values: [
    {
      value: ["0xaF7E68bCb2Fc7295492A00177f14F59B92814e70", 0],
      treeIndex: 1,
    },
    {
      value: ["0x6568322A7d8212236eA784bA0c7C2dEa1e6EAB0F", 1715121121],
      treeIndex: 2,
    },
  ],
  leafEncoding: ["address", "uint32"],
}

export const tree = StandardMerkleTree.load(rawTree)
