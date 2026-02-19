// client/src/components/GoalTree/GoalTreeComponent.tsx
import React, { useState } from 'react';
import { GoalNode, exampleGoalTreeData } from '../../../types/goal';
import GoalNodeComponent from './GoalNodeComponent';
import { Box, Container } from '@mui/material';

interface GoalTreeComponentProps {
    data: GoalNode[];
}

const GoalTreeComponent: React.FC<GoalTreeComponentProps> = ({ data }) => {
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    const toggleExpand = (nodeId: string) => {
        setExpandedNodes((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(nodeId)) {
                newSet.delete(nodeId);
            } else {
                newSet.add(nodeId);
            }
            return newSet;
        });
    };

    const renderGoalNodeAndChildren = (nodes: GoalNode[], level: number = 0) => {
        return nodes.map((node) => (
            <Box key={node.id}>
                <GoalNodeComponent
                    node={node}
                    isExpanded={expandedNodes.has(node.id)}
                    onToggleExpand={toggleExpand}
                    level={level}
                    hasChildren={node.children && node.children.length > 0}
                />
                {expandedNodes.has(node.id) && node.children && node.children.length > 0 && (
                    <Box sx={{ pl: 2 }}> {/* Indent children */}
                        {renderGoalNodeAndChildren(node.children, level + 1)}
                    </Box>
                )}
            </Box>
        ));
    };

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {renderGoalNodeAndChildren(data)}
        </Container>
    );
};

export default GoalTreeComponent;
