import { alterarSenha } from "@/actions/auth";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho, Painel } from "@/components/ui";

export const metadata = { title: "Minha Senha" };

export default function ContaPage() {
  return (
    <>
      <Cabecalho titulo="Minha Senha" descricao="Altere a senha do seu usuário." />
      <Painel className="max-w-md">
        <FormAcao acao={alterarSenha} botao="Alterar senha">
          <div>
            <label className="label" htmlFor="atual">Senha atual</label>
            <input id="atual" name="atual" type="password" className="input" required autoComplete="current-password" />
          </div>
          <div>
            <label className="label" htmlFor="nova">Nova senha</label>
            <input id="nova" name="nova" type="password" className="input" required minLength={6} autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="confirmacao">Confirme a nova senha</label>
            <input id="confirmacao" name="confirmacao" type="password" className="input" required minLength={6} autoComplete="new-password" />
          </div>
        </FormAcao>
      </Painel>
    </>
  );
}
