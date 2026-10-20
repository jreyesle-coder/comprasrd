import type { Metadata } from "next";
import { PaginaLegal } from "../pie";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function Privacidad() {
  return (
    <PaginaLegal titulo="Política de privacidad">
      <p>Esta política explica qué datos personales trata el Radar de Compras Públicas RD y para qué, conforme a la Ley 172-13 sobre protección de datos personales de la República Dominicana.</p>
      <h2>1. Datos que recopilamos</h2>
      <p>Nombre, correo y teléfono de los usuarios y contactos del Cliente; datos de uso de la plataforma (accesos, estados y notas de seguimiento); y los datos del formulario de solicitud de demostración.</p>
      <h2>2. Para qué los usamos</h2>
      <p>Para dar acceso al Servicio, enviar los resúmenes diarios y avisos de la cuenta, atender soporte y facturar. No vendemos ni alquilamos datos personales.</p>
      <h2>3. Información pública</h2>
      <p>La información de procesos, contratos, ofertas y proveedores proviene de fuentes públicas (API de Datos Abiertos de la DGCP).</p>
      <h2>4. Con quién se comparten</h2>
      <p>Con proveedores que nos ayudan a operar el Servicio (alojamiento, base de datos y envío de correos), bajo acuerdos de confidencialidad, y con autoridades cuando la ley lo exija.</p>
      <h2>5. Conservación</h2>
      <p>Mientras la cuenta esté activa y hasta 12 meses después de su cancelación, salvo obligación legal de conservarlos por más tiempo.</p>
      <h2>6. Tus derechos</h2>
      <p>Puedes pedir acceso, rectificación o eliminación de tus datos, y dejar de recibir los resúmenes en cualquier momento, escribiendo al correo de soporte.</p>
      <h2>7. Seguridad</h2>
      <p>Usamos conexiones cifradas, control de acceso por empresa y copias de seguridad de la base de datos.</p>
    </PaginaLegal>
  );
}
