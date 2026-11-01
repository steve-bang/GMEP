import type { ReactNode } from 'react';
import { Icon } from './Icon';

/** Shared frame of the G1/G5 authentication screens (brand, card, footer). */
export function AuthLayout(props: {
  brand: string;
  skip: string;
  title: string;
  lead?: string;
  footer: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="g1-auth-body">
      <a className="skip-link" href="#main">
        {props.skip}
      </a>
      <div className="g1-auth-brand">
        <span className="g1-auth-brand__logo" aria-hidden="true">
          <Icon name="wrench" />
        </span>
        {props.brand}
      </div>
      <div className="g1-wrap">
        <main
          className={`g1-auth-card${props.wide ? ' g1-auth-card--wide' : ''}`}
          id="main"
          aria-labelledby="t"
        >
          <div>
            <h1 id="t">{props.title}</h1>
            {props.lead ? <p className="g1-lead">{props.lead}</p> : null}
          </div>
          {props.children}
        </main>
        <footer className="g1-auth-foot">
          <span>{props.footer}</span>
        </footer>
      </div>
    </div>
  );
}
