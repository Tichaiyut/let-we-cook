import { ChartLineUp, Code, Database, Robot, User } from "@phosphor-icons/react";

// Presentation for the kitchen crew. The member list itself comes from the
// People sheet; this file only decides how each chef looks.
//
// To use real character artwork later, put the image in public/characters/
// and set `image`, e.g. image: "characters/sorawee.png".
export const CREW = {
  arparat: {
    name: "Arparat",
    title: "Saint - Chan",
    role: "Data Provider",
    specialty: "Data supply & quality",
    color: "#c2417a",
    icon: Database,
    image: null,
  },
  tichaiyut: {
    name: "Tichaiyut",
    title: "Topu - Kun",
    role: "Data Scientist",
    specialty: "Insights & analytics",
    color: "#1f8a70",
    icon: ChartLineUp,
    image: null,
  },
  chonlasit: {
    name: "Chonlasit",
    title: "Bon - Kun",
    role: "AI Engineer",
    specialty: "AI models & automation",
    color: "#7a4fd0",
    icon: Robot,
    image: null,
  },
  sorawee: {
    name: "Sorawee",
    title: "Ing - Kun",
    role: "Web Developer",
    specialty: "Web apps & experience",
    color: "#d8572a",
    icon: Code,
    image: null,
  },
};

export const CREW_ORDER = ["arparat", "tichaiyut", "chonlasit", "sorawee"];

const GENERIC_CHEF = { title: "Kitchen Crew", role: "Chef", specialty: "", color: "#7a6a5c", icon: User, image: null };

export function chefProfile(id, person) {
  const key = String(id || "").toLowerCase();
  const known = CREW[key];
  return {
    id: key,
    ...GENERIC_CHEF,
    ...(known || {}),
    name: person?.name || known?.name || key || "Unassigned",
    title: person?.characterName || known?.title || GENERIC_CHEF.title,
    role: person?.role || known?.role || GENERIC_CHEF.role,
  };
}

export function sortCrew(people) {
  const rank = (id) => {
    const index = CREW_ORDER.indexOf(String(id).toLowerCase());
    return index === -1 ? CREW_ORDER.length : index;
  };
  return [...people].sort((a, b) => rank(a.id) - rank(b.id) || String(a.name).localeCompare(String(b.name)));
}
