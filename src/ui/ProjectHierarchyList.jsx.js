import React, { PureComponent } from 'react';

import { Flex } from 'fds/components';

import ProjectHierarchyListNode from './ProjectHierarchyListNode.jsx';

class ProjectHierarchyList extends PureComponent {
	render() {
		const { onItemClick, rootNodes, selectedAncestors, selectedNode } = this.props;

		return (
			<Flex flex="1" flexDirection="column">
				{rootNodes.map((node, index) => (
					<ProjectHierarchyListNode
						key={node.id || index}
						node={node}
						onItemClick={onItemClick}
						selectedAncestors={selectedAncestors}
						selectedNode={selectedNode}
					/>
				))}
			</Flex>
		);
	}
}

export default ProjectHierarchyList;
