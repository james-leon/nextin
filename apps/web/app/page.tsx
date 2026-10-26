import { redirect } from "next/navigation";

// M1 : seule la vitrine du design system existe. L'accueil client est construit au M4.
export default function Home() {
  redirect("/design");
}
