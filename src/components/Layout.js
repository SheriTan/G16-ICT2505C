import { Outlet } from "react-router-dom";
import Header from "./Header";

export default function Layout(props) {
  return (
    <>
      <Header
        api={props.api}
        teams={props.teams}
        setTeams={props.setTeams}
        selectedTeamID={props.selectedTeamID}
        setSelectedTeamID={props.setSelectedTeamID}
        refreshTeams={props.refreshTeams}
      />
      <main>
        <Outlet context={{
          api: props.api,
          teams: props.teams,
          setTeams: props.setTeams,
          selectedTeamID: props.selectedTeamID,
          setSelectedTeamID: props.setSelectedTeamID,
          refreshTeams: props.refreshTeams
        }} />
      </main>
    </>
  );
}