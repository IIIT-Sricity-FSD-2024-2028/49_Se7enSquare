import { createSelector } from '@reduxjs/toolkit';

const selectChannels = (state) => state.chat.channels;
const selectMessages = (state) => state.chat.messages;
const selectMembers = (state) => state.chat.members;

export const selectFilteredChannels = createSelector(
  [selectChannels, (state) => state.chat.channelSearch],
  (channels, query) => channels.filter((channel) => channel.name.toLowerCase().includes(query.toLowerCase())),
);

export const selectFilteredMessages = createSelector(
  [selectMessages, (state) => state.chat.msgSearchQuery],
  (messages, query) => query
    ? messages.filter((message) => message.text.toLowerCase().includes(query.toLowerCase()))
    : messages,
);

export const selectPinnedMessages = createSelector(
  [selectMessages],
  (messages) => messages.filter((message) => message.pinned),
);

export const selectChatStats = createSelector(
  [selectChannels, selectMessages, selectMembers],
  (channels, messages, members) => ({
    channels: channels.length,
    messages: messages.length,
    members: members.length,
  }),
);
