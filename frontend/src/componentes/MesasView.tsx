import React from 'react';
import { FlujoOrdenes } from './FlujoOrdenes';

/** Órdenes de caja usa el mismo flujo que la tablet, con el origen de sus tickets. */
export const MesasView: React.FC<{ nombreUsuario: string }> = ({ nombreUsuario }) => (
  <FlujoOrdenes origen={`CAJA · ${nombreUsuario}`} />
);
