import { executeQuery } from '../db.js';
import moment from 'moment';

class GroupsController {
    // Show all groups
    static showGroups = async (req, res) => {
        try {
            const groups = await executeQuery(
                `SELECT 
                    group_id, group_code, group_name, base_group, group_code2, group_name2,
                    seq_sr, status, c_at, c_by
                 FROM groups
                 ORDER BY group_id ASC` //seq_sr
            );

            const baseGroups = await executeQuery(
                `SELECT DISTINCT base_group FROM groups ORDER BY base_group`
            );
            
            
            res.render('sap-group/view-group', {
                title: 'Groups Management',
                groups, 
                baseGroups                
            });
        } catch (error) {
            console.error('Error showing groups:', error);
            res.status(500).render('error', {
                message: 'Error loading groups'
            });
        }
    }

    // Find group by code
    static findGroupByCode = async (groupCode) => {
        const result = await executeQuery(
            'SELECT * FROM groups WHERE group_code = ?',
            [groupCode]
        );
        return result.length > 0 ? result[0] : null;
    }

    // Update group information
    static updateGroupInformation = async (groupId, groupData) => {
        const {
            group_code,
            group_name,
            base_group,
            group_code2,
            group_name2
        } = groupData;

        if (groupId) {
            // Update existing group
            await executeQuery(
                `UPDATE groups 
                 SET group_code = ?, group_name = ?, base_group = ?, 
                     group_code2 = ?, group_name2 = ?, u_at = NOW(), u_by = 1
                 WHERE group_id = ?`,
                [group_code, group_name, base_group, group_code2, group_name2, groupId]
            );
            return groupId;
        } else {
            // Create new group - get next sequence and ID
            const maxSeqResult = await executeQuery(
                'SELECT COALESCE(MAX(seq_sr), 0) + 1 as next_seq FROM groups'
            );
            const nextSeq = maxSeqResult[0].next_seq;

            const maxIdResult = await executeQuery(
                'SELECT COALESCE(MAX(group_id), 0) + 1 as next_id FROM groups'
            );
            const nextId = maxIdResult[0].next_id;

            await executeQuery(
                `INSERT INTO groups 
                 (group_id, group_code, group_name, base_group, group_code2, group_name2, seq_sr, status, c_at, c_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'A', NOW(), 1)`,
                [nextId, group_code, group_name, base_group, group_code2, group_name2, nextSeq]
            );
            
            return nextId;
        }
    }

    // Add new group
    static addGroup = async (req, res) => {
        try {
            const { groupCode, groupName, baseGroup, groupCode2, groupName2 } = req.body;

            if (!groupCode || !groupName || !baseGroup) {
                return res.status(400).json({ success: false, message: 'Group code, name and base group are required' });
            }

            const existingGroup = await this.findGroupByCode(groupCode);
            if (existingGroup) {
                return res.status(400).json({ success: false, message: 'Group code already exists' });
            }

            const newGroupId = await this.updateGroupInformation(null, {
                group_code: groupCode,
                group_name: groupName,
                base_group: baseGroup,
                group_code2: groupCode2,
                group_name2: groupName2
            });

            res.json({ success: true, groupId: newGroupId });
        } catch (error) {
            console.error('Error adding group:', error);
            res.status(500).json({ success: false, message: 'Error adding group' });
        }
    }

    // Update group
    static updateGroup = async (req, res) => {
        try {
            const { groupId, groupCode, groupName, baseGroup, groupCode2, groupName2, sequence, status } = req.body;

            if (!groupId || !groupCode || !groupName || !baseGroup || !sequence) {
                return res.status(400).json({ success: false, message: 'Missing required fields' });
            }

            const existingGroup = await this.findGroupByCode(groupCode);
            if (existingGroup && existingGroup.group_id !== parseInt(groupId)) {
                return res.status(400).json({ success: false, message: 'Group code already exists' });
            }

            await executeQuery(
                `UPDATE groups 
                 SET group_code = ?, group_name = ?, base_group = ?, 
                     group_code2 = ?, group_name2 = ?, seq_sr = ?, status = ?, u_at = NOW(), u_by = 1
                 WHERE group_id = ?`,
                [groupCode, groupName, baseGroup, groupCode2, groupName2, sequence, status, groupId]
            );

            res.json({ success: true, message: 'Group updated successfully' });
        } catch (error) {
            console.error('Error updating group:', error);
            res.status(500).json({ success: false, message: 'Error updating group' });
        }
    }

    // Delete group
    static deleteGroup = async (req, res) => {
        try {
            const { groupId } = req.body;

            if (!groupId) {
                return res.status(400).json({ success: false, message: 'Group ID is required' });
            }

            // Check if group is used in any products
            const productCount = await executeQuery(
                'SELECT COUNT(*) as count FROM products WHERE group_id = ?',
                [groupId]
            );

            if (productCount[0].count > 0) {
                return res.status(400).json({ success: false, message: 'Group cannot be deleted as it is used by products' });
            }

            await executeQuery('DELETE FROM groups WHERE group_id = ?', [groupId]);

            res.json({ success: true, message: 'Group deleted successfully' });
        } catch (error) {
            console.error('Error deleting group:', error);
            res.status(500).json({ success: false, message: 'Error deleting group' });
        }
    }
}

export default GroupsController;