import { useContext } from "react";
import { chefProfile } from "../team.js";
import { CharacterArt, CrewContext } from "./common.jsx";

export function CrewPage({ crew, tasks }) {
  const peopleById = useContext(CrewContext);
  return (
    <section className="crew-page">
      <header>
        <span>TechFeed Kitchen Crew</span>
        <h1>Meet the chefs</h1>
        <p>ทีมเชฟของเรา · ตัวเลขบนการ์ดคำนวณจากงานบนบอร์ดตอนนี้</p>
      </header>
      <div className="crew-grid">
        {crew.map((person) => {
          const chef = chefProfile(person.id, peopleById[person.id]);
          const mine = tasks.filter((task) => task.assignees.includes(person.id));
          const served = mine.filter((task) => task.status === "Done").length;
          const cooking = mine.filter((task) => task.status === "In Progress").length;
          const rate = mine.length ? Math.round((served / mine.length) * 100) : 0;
          const menus = [...new Map(mine.map((task) => [task.epic, task.color])).entries()].slice(0, 4);
          return (
            <article className="crew-card" key={person.id} style={{ "--chef": chef.color }}>
              <CharacterArt chef={chef} />
              <div className="crew-card__identity">
                <small>{chef.role}</small>
                <h2>{chef.title}</h2>
                <b>{chef.name}</b>
                {chef.specialty && <p>{chef.specialty}</p>}
              </div>
              <div className="crew-stats">
                <span><b>{mine.length}</b>Food pieces</span>
                <span><b>{cooking}</b>Cooking</span>
                <span><b>{rate}%</b>Served</span>
              </div>
              <div className="crew-served-bar" aria-hidden="true"><i style={{ width: `${rate}%` }} /></div>
              <div className="crew-menus">
                <small>Current menus</small>
                <div>
                  {menus.length ? menus.map(([menu, color]) => <span key={menu} style={{ "--menu": color }}>{menu}</span>) : <em>ยังไม่มีเมนู</em>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
