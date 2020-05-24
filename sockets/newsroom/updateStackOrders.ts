import { Socket } from 'socket.io';
import { sequelize, Stack } from '@Models';
import _ from 'lodash';
import { StackService, AccessControlService } from '@Services';

import getRoomName from './getRoomName';

type data = {
  stackId: number;
  order: number;
}

export default function updateStackOrders(socket: Socket) {
  socket.on('update stack orders', async (eventId: number, stacks: data[], cb: Function = () => {}) => {
    if (!_.isArray(stacks)) {
      return cb('Invalid input：stacks');
    }

    const { clientId } = socket.handshake.session;
    const haveAccess = await AccessControlService.isAllowedToEditEvent(clientId, eventId);
    if (!haveAccess) return cb('You are not allowed to edit this event.');

    for (const { stackId } of stacks) {
      const stack = await Stack.findByPk(stackId, { attributes: ['eventId'] });
      if (stack.eventId !== eventId) {
        return cb('The stacks need to belong to the same event');
      }
    }

    await sequelize.transaction(async transaction => {
      const queue = stacks.map(({ stackId, order }) => StackService.updateStack({
        id: stackId,
        data: { order },
        clientId,
        transaction,
      }));
      await Promise.all(queue);
      socket.in(getRoomName(eventId)).emit('update stack orders', {
        eventId,
        stacks,
      });
      cb();
    });
  });
}
