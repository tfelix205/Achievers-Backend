const { Contribution, Group, Membership } = require('../models');
const { v4: uuidv4 } = require('uuid');

exports.makeContribution = async (req, res) => {
    try {
        const { groupId, amount, cycleId } = req.body;
        const userId = req.user.id;


        const group = await Group.findByPk(groupId);

        if (!group) {
            return res.status(404).json({
                message: 'Group not found'
            });
        }


        const member = await Membership.findOne({
            where: { groupId, userId }
        });

        if (!member) {
            return res.status(403).json({
                message: 'You are not a member of this group'
            });
        }


        // if (!group.isCycleStarted) return res.status(400).json({
        //  message: 'Contribution cycle has not started yet' 
        // });

        if (parseFloat(amount) !== parseFloat(group.contributionAmount)) {
            return res.status(400).json({
                message: `Contribution amount must be exactly ${group.contributionAmount}`
            });
        }


        if (member.paymentStatus === 'paid') {
            return res.status(400).json({
                message: 'You have already made your contribution for this cycle'
            });
        }


        const contribution = await Contribution.create({
            id: uuidv4(),
            groupId,
            memberId: member.id,
            amount,
            cycleId,
            paymentDate: new Date(),
            status: 'paid'
        });


        member.paymentStatus = 'paid';
        await member.save();

        res.status(201).json({
            message: 'Contribution made successfully',
            data: contribution
        });
    } catch (error) {
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
};


