import React, { PureComponent } from 'react';

import { Block, Flex, Icon, Label } from 'fds/components';
import {
	applyCss,
	border,
	borderLeft,
	color,
	flex,
	paddingLeft,
	paddingRight,
	spaceHorizontal
} from 'fds/system';
import t from 'fontoxml-localization/t';

const determineStylesByColorName = (basicStyles, colorName) =>
	applyCss([
		...basicStyles,
		{
			backgroundColor: color(colorName + '-background')
		},
		border(color(colorName + '-border')),
		{
			':hover': {
				backgroundColor: color(colorName + '-background:hover'),
				borderColor: color(colorName + '-border:hover')
			}
		}
	]);

const determineStyles = (node, isDescendantSelected, isSelected) => {
	const styles = [
		{ alignItems: 'center' },
		!node.isPlaceholder && { cursor: 'pointer' },
		flex('row'),
		{ paddingBottom: '.375rem', paddingTop: '.375rem' },
		paddingLeft('s'),
		paddingRight('s'),
		spaceHorizontal('s')
	];

	if (isSelected) {
		return determineStylesByColorName(styles, 'structure-view-node-item-active-document');
	}

	if (isDescendantSelected) {
		return determineStylesByColorName(
			styles,
			'structure-view-node-item-parent-of-active-document'
		);
	}

	return determineStylesByColorName(styles, 'structure-view-node-item');
};

const childrenContainerStyles = [
	borderLeft(color('structure-view-node-children-border'), '1px', 'solid'),
	{ marginLeft: 'calc(1rem - 2px)' },
	paddingLeft('l')
];

class ProjectHierarchyListNode extends PureComponent {
	handleItemClick = () => {
		if (this.props.node.isPlaceholder) {
			return;
		}

		this.props.onItemClick(this.props.node);
	};

	render() {
		const { node, onItemClick, selectedAncestors, selectedNode } = this.props;

		const isSelected = selectedNode && selectedNode.rootNodeId === node.contextNodeId;
		const isDescendantSelected = selectedAncestors.some(
			selectedAncestor => selectedAncestor === node.contextNodeId
		);

		return (
			<Block flex="none">
				<Flex
					{...determineStyles(node, isDescendantSelected, isSelected)}
					onClick={this.handleItemClick}
				>
					<Icon icon={node.icon} />

					{node.title ? (
						<Label flex="1">{node.title}</Label>
					) : (
						<Label flex="1" colorName="text-muted-color">
							{t('Untitled {MARKUPLABEL}', { MARKUPLABEL: node.markupLabel })}
						</Label>
					)}
				</Flex>

				{node.children.length > 0 && (
					<Block applyCss={childrenContainerStyles}>
						{node.children.map((childNode, index) => (
							<ProjectHierarchyListNode
								key={childNode.id || index}
								node={childNode}
								onItemClick={onItemClick}
								selectedAncestors={selectedAncestors}
								selectedNode={selectedNode}
							/>
						))}
					</Block>
				)}
			</Block>
		);
	}
}

export default ProjectHierarchyListNode;
