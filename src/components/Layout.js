import { Outlet } from "react-router-dom";
import Header from "./Header";

export default function Layout(props) {
  return (
    <>
      <Header
        teams={props.teams}
        selectedTeamID={props.selectedTeamID}
        setSelectedTeamID={props.setSelectedTeamID}
      />
      <main>
        <Outlet />
      </main>
    </>
  );
}