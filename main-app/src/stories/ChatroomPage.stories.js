import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ChatroomPage from "../pages/ChatroomPage";

export default {
  title: "pages/ChatroomPage",
  component: ChatroomPage,
  decorators: [
    (Story) => {
      localStorage.setItem("username", "TestUser");
      return <Story />;
    },
  ],
};

const Template = (args) => (
  <MemoryRouter initialEntries={["/chatroom/123"]}>
    <Routes>
      <Route path="/chatroom/:lobbyId" element={<ChatroomPage {...args} />} />
    </Routes>
  </MemoryRouter>
);

export const Default = Template.bind({});
Default.args = {};