// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StringUtils} from "@ensdomains/ens-contracts/utils/StringUtils.sol";

import {IL2Registry} from "../interfaces/IL2Registry.sol";

/// @dev This is an example registrar contract that is mean to be modified.
contract L2Registrar {
    using StringUtils for string;

    /// @notice Emitted when a new name is registered
    /// @param label The registered label (e.g. "name" in "name.eth")
    /// @param owner The owner of the newly registered name
    event NameRegistered(string indexed label, address indexed owner);

    /// @notice Emitted when a text record is updated
    /// @param label The label for which the text record was updated
    /// @param repository The repository name (key)
    /// @param cid The CID value
    event TextRecordUpdated(string indexed label, string indexed repository, string cid);

    /// @notice Reference to the target registry contract
    IL2Registry public immutable registry;

    /// @notice The chainId for the current chain
    uint256 public chainId;

    /// @notice The coinType for the current chain (ENSIP-11)
    uint256 public immutable coinType;

    /// @notice Contract owner (can update any text record)
    address public immutable owner;

    /// @notice Mapping to track all text record keys for each node
    mapping(bytes32 => string[]) private textRecordKeys;
    
    /// @notice Mapping to track if a key exists for a node (to avoid duplicates)
    mapping(bytes32 => mapping(string => bool)) private keyExists;

    /// @notice Initializes the registrar with a registry contract
    /// @param _registry Address of the L2Registry contract
    constructor(address _registry) {
        // Save the chainId in memory (can only access this in assembly)
        assembly {
            sstore(chainId.slot, chainid())
        }

        // Calculate the coinType for the current chain according to ENSIP-11
        coinType = (0x80000000 | chainId) >> 0;

        // Save the registry address
        registry = IL2Registry(_registry);
        
        // Set the contract owner to the deployer
        owner = msg.sender;
    }

    /// @notice Registers a new name
    /// @param label The label to register (e.g. "name" for "name.eth")
    /// @param owner The address that will own the name
    /// @param addr The address to set in the address record (can be different from owner)
    function register(string calldata label, address owner, address addr) external {
        bytes32 node = _labelToNode(label);
        bytes memory addrBytes = abi.encodePacked(addr); // Convert address to bytes

        // Set the forward address for the current chain. This is needed for reverse resolution.
        // E.g. if this contract is deployed to Base, set an address for chainId 8453 which is
        // coinType 2147492101 according to ENSIP-11.
        registry.setAddr(node, coinType, addrBytes);

        // Set the forward address for mainnet ETH (coinType 60) for easier debugging.
        registry.setAddr(node, 60, addrBytes);

        // Register the name in the L2 registry
        registry.createSubnode(
            registry.baseNode(),
            label,
            owner,
            new bytes[](0)
        );
        emit NameRegistered(label, owner);
    }

    /// @notice Checks if a given label is available for registration
    /// @dev Uses try-catch to handle the ERC721NonexistentToken error
    /// @param label The label to check availability for
    /// @return available True if the label can be registered, false if already taken
    function available(string calldata label) external view returns (bool) {
        bytes32 node = _labelToNode(label);
        uint256 tokenId = uint256(node);

        try registry.ownerOf(tokenId) {
            return false;
        } catch {
            if (label.strlen() >= 3) {
                return true;
            }
            return false;
        }
    }

    function _labelToNode(
        string calldata label
    ) private view returns (bytes32) {
        return registry.makeNode(registry.baseNode(), label);
    }

    /// @notice Updates a text record for a given subdomain
    /// @param label The label of the subdomain (e.g. "name" for "name.gitvault.eth")
    /// @param repository The repository name to use as the key
    /// @param cid The CID value to associate with the repository
    function updateTextRecord(
        string calldata label,
        string calldata repository,
        string calldata cid
    ) external {
        bytes32 node = _labelToNode(label);
        
        // Check if the caller is the owner of the subdomain OR the contract owner
        uint256 tokenId = uint256(node);
        address nodeOwner = registry.ownerOf(tokenId);
        require(msg.sender == nodeOwner || msg.sender == owner, "Only the owner or contract owner can update text records");
        
        // Additional check: ensure the subdomain resolves to a valid address (skip for contract owner)
        if (msg.sender != owner) {
            address resolvedAddress = registry.addr(node);
            require(msg.sender == resolvedAddress, "Subdomain must resolve to your address");
        }
        
        // Add key to tracking if it doesn't exist
        if (!keyExists[node][repository]) {
            textRecordKeys[node].push(repository);
            keyExists[node][repository] = true;
        }
        
        // Set the text record: repository -> cid
        registry.setText(node, repository, cid);
        
        emit TextRecordUpdated(label, repository, cid);
    }

    /// @notice Retrieves a text record for a given subdomain and key
    /// @param label The label of the subdomain (e.g. "name" for "name.gitvault.eth")
    /// @param key The key to retrieve the text record for (e.g. repository name)
    /// @return value The text record value (e.g. CID) associated with the key
    function getTextRecord(
        string calldata label,
        string calldata key
    ) external view returns (string memory value) {
        bytes32 node = _labelToNode(label);
        return registry.text(node, key);
    }

    /// @notice Retrieves all text record keys for a given subdomain
    /// @param label The label of the subdomain (e.g. "name" for "name.gitvault.eth")
    /// @return keys Array of all text record keys for the subdomain
    function getTextRecordKeys(
        string calldata label
    ) external view returns (string[] memory keys) {
        bytes32 node = _labelToNode(label);
        return textRecordKeys[node];
    }

    /// @notice Retrieves all text records for a given subdomain
    /// @param label The label of the subdomain (e.g. "name" for "name.gitvault.eth")
    /// @return keys Array of all text record keys
    /// @return values Array of all text record values (corresponding to keys)
    function getAllTextRecords(
        string calldata label
    ) external view returns (string[] memory keys, string[] memory values) {
        bytes32 node = _labelToNode(label);
        keys = textRecordKeys[node];
        values = new string[](keys.length);
        
        for (uint256 i = 0; i < keys.length; i++) {
            values[i] = registry.text(node, keys[i]);
        }
    }
} 