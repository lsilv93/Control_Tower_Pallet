import { redirect } from "next/navigation";

/** O antigo "Retorno do CD" agora é a conferência de retorno (com Vale-Ocorrência). */
export default function Page() {
  redirect("/retorno");
}
