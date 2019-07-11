import { Node, ThreeDListNodesParams} from '@cognite/sdk';
import * as sdk from '@cognite/sdk';
import { Tree } from 'antd';
import { AntTreeNode, AntTreeNodeProps } from 'antd/lib/tree';
import React, { Component } from 'react';
import styled from 'styled-components';
import {
  NodeTreeProps,
  OnSelectNodeTreeParams,
  TreeNodeData,
  TreeNodeType,
} from '../../interfaces';
import { defaultTheme } from '../../theme/defaultTheme';
import {
  applyThemeFontFamily,
  applyThemeFontSize,
  applyThemeListHighlight,
} from '../../utils/theme';

const { TreeNode } = Tree;

interface ExpandedKeysMap {
  [key: number]: true;
}

interface NodeTreeState {
  threeDNodes: Node[];
  treeData: TreeNodeData[];
  expandedKeys: ExpandedKeysMap;
  modelId: number,
  revisionId: number
  loadedKeys: string[]
}

const cursorApiRequest = async (
  modelId: number,
  revisionId: number,
  params: ThreeDListNodesParams,
  data: Node[] = [],
): Promise<Node[]> => {
  const result = await sdk.ThreeD.listNodes(modelId, revisionId, params);
  const { nextCursor: cursor } = result;
  if (result.nextCursor) {
    return cursorApiRequest(modelId, revisionId, { ...params, cursor }, [
      ...data,
      ...result.items,
    ]);
  }
  return [...data, ...result.items];
};



export class NodeTree extends Component<NodeTreeProps, NodeTreeState> {

  mapDataNodes(threeDNodes: Node[]): TreeNodeData[] {
    const nodes: { [name: string]: TreeNodeData } = {};

    threeDNodes.forEach(threeDNode => {
      if (threeDNode.depth == 0) {
        nodes[threeDNode.id] = NodeTree.returnPretty(threeDNode);
      }
    });

    threeDNodes.forEach(threeDNode => {
      const { parentId } = threeDNode;
      const node = nodes[parentId as number]; // casting is not a problem. It will return undefined if not found
      if (!node) {
        return;
      }
      node.isLeaf = false;
      console.log(parentId);
    });
    return Object.keys(nodes).map(id => {
      if (nodes[id].isLeaf) {
        this.state.loadedKeys.push(`${id}`);
      }
      this.setState({
        loadedKeys: [...this.state.loadedKeys]
      });
      return nodes[id];
    });
  }

  static returnPretty(threeDNode: Node) {
    return {
      title: `${threeDNode.name}`,
      key: threeDNode.id,
      node: threeDNode,
      isLeaf: true,
    };
  }

  static toKeys(path: number[], initial = {}): ExpandedKeysMap {
    return path.reduce((acc, i) => ({ ...acc, [i]: true }), initial);
  }

  static defaultProps = {
    modelId: 0,
    revisionId: 0,
    onSelect:  (selectedNode : OnSelectNodeTreeParams) => {
      // console.log(selectedNode.key);
      return selectedNode.key;
    }
  }

  constructor(props: NodeTreeProps) {
    super(props);
    const { defaultExpandedKeys } = props;
    this.state = {
      threeDNodes: [],
      treeData: [],
      expandedKeys: defaultExpandedKeys
        ? NodeTree.toKeys(defaultExpandedKeys)
        : {},
      modelId: props.modelId,
      revisionId: props.revisionId,
      loadedKeys: []
    };
  }

  async componentDidMount() {
    const threeDNodes = await sdk.ThreeD.listNodes(this.state.modelId, this.state.revisionId, {depth: 1});
    this.setState({
      threeDNodes: threeDNodes.items,
      treeData:
      threeDNodes && threeDNodes.items.length > 0
          ? this.mapDataNodes(threeDNodes.items)
          : [],
    });
  }

  onLoadData = async (treeNode: AntTreeNode) => {
    if (treeNode.props.children) {
      return;
    }
    const eventKey = treeNode.props.eventKey;
    const assetId = eventKey ? Number.parseInt(eventKey, 10) : undefined;

    if (assetId && !Number.isNaN(assetId)) {
      const query = {
        depth: 2,
        nodeId: assetId
      };

      const loadedData = await cursorApiRequest(this.state.modelId, this.state.revisionId, query);
      if (loadedData.length > 1) {
        treeNode.props.dataRef.children = loadedData
          .slice(1)
          // @ts-ignore
          .sort((a, b) => a.name.localeCompare(b.name))
          .filter(x => x.parentId && x.parentId === treeNode.props.dataRef.key)
          .map(x => {
            if (loadedData.filter(y => y.parentId === x.id).length <= 0) {
              this.state.loadedKeys.push(`${x.id}`);
              return ({
                title: `${x.name}`,
                key: x.id,
                node: x,
                isLeaf: true,
              });
            } else {
              return ({
                title: `${x.name}`,
                key: x.id,
                node: x,
                isLeaf: false,
              });
            }
          });
        this.setState({
          loadedKeys: [... this.state.loadedKeys],
          treeData: [...this.state.treeData],
        });
      } else {
        treeNode.props.dataRef.isLeaf = true;
      }
    }
  };

  onSelectNode = (returnAsset: OnSelectNodeTreeParams) => {
    const { onSelect } = this.props;
    if (onSelect) {
      onSelect(returnAsset);
    }
  };

  onExpand = (expandedKeys: string[]) => {
    this.setState({
      expandedKeys: NodeTree.toKeys(
        expandedKeys.map(key => Number.parseInt(key, 10))
      ),
    });
  };

  renderTreeNode = (nodes: TreeNodeType[]) => {
    const { styles } = this.props;
    return nodes.map(item => {
      if (item.children) {
        return (
          <TreeNodeWrapper
            title={item.title}
            key={item.key}
            dataRef={item}
            style={styles && styles.list}
          >
            {this.renderTreeNode(item.children)}
          </TreeNodeWrapper>
        );
      }
      return (
        <TreeNodeWrapper
          title={item.title}
          key={item.key}
          dataRef={item}
          style={styles && styles.list}
        />
      );
    });
  };

  render() {
    const { treeData, expandedKeys } = this.state;
    return (
      <Tree
        loadData={this.onLoadData}
        onSelect={(_, e) => this.onSelectNode(e.node.props.dataRef)}
        expandedKeys={Object.keys(expandedKeys)}
        onExpand={this.onExpand}
        loadedKeys = {this.state.loadedKeys}
      >
        {this.renderTreeNode(treeData)}
      </Tree>
    );
  }
}

const TreeNodeWrapper = styled(TreeNode)<AntTreeNodeProps>`
  ${({ theme }) => applyThemeFontFamily(theme.gearbox)}
  ${({ theme }) => applyThemeFontSize(theme.gearbox)}
  & span {
    color: ${({ theme }) => theme.gearbox.textColor};
  }
  & .ant-tree-node-selected {
    ${({ theme }) => applyThemeListHighlight(theme.gearbox)}
  }
`;

TreeNodeWrapper.defaultProps = {
  theme: {
    gearbox: defaultTheme,
  },
};
