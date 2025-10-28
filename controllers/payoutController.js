const { Group, Payout, Contribution, Membership } = require('../models');
const { v4: uuidv4 } = require('uuid');

exports.createPayout = async (req, res) => {
    try {
        const { groupId, cycleId, userId } = req.body;
        const adminUserId = req.user.id;

        const group = await Group.findByPk(groupId);

        if (!group) {
            return res.status(404).json({
                message: 'Group not found'
            });
        }

        if (group.adminId !== adminUserId) {
            return res.status(403).json({
                message: 'Access denied: Only group admins can trigger payouts'
            });
        }

        const membership = await Membership.findOne({ where: { userId, groupId } });

        if (!membership) {
            return res.status(404).json({
                message: 'Membership not found for this user in the specified group'
            });
        }

        const contribution = await Contribution.findOne({ where: { memberId: membership.id, groupId, cycleId } });

        if (!contribution) {
            return res.status(404).json({
                message: 'No contribution found for this member in the specified cycle'
            });
        }

        if (membership.hasReceived) {
            return res.status(400).json({
                message: 'Payout has already been made to this member for the current cycle'
            });
        }

        const commissionRate = parseFloat(group.commissionRate) || 2;
        const commissionFee = (commissionRate / 100) * parseFloat(contribution.amount);
        let penaltyFee = 0;
        if (contribution.isLate) penaltyFee = parseFloat(group.penaltyFee) || 5.0;

        const finalAmount = parseFloat(contribution.amount) - commissionFee - penaltyFee;

        const payout = await Payout.create({
            id: uuidv4(),
            groupId,
            userId,
            cycleId,
            amount: contribution.amount,
            commissionFee,
            penaltyFee,
            status: 'completed',
            payoutDate: new Date()
        });

        // Mark membership as having received the payout
        membership.hasReceived = true;
        await membership.save();

        res.status(201).json({
            message: 'Payout created successfully',
            payout: { ...payout.dataValues, finalAmount }
        });
    } catch (error) {
        res.status(500).json({
            message: 'Internal server error', error: error.message
        });
    }
};
