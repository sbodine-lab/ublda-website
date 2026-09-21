import { ArrowUpRight } from "lucide-react";
import { Button } from "./Studio";
import { RESEARCH } from "./research";
import "./business-case.css";

const CARDS = [
  { id: "disability-is-not-a-niche", theme: "reach", image: "workplace-meeting" },
  { id: "disability-in-the-workforce", theme: "workforce" },
  { id: "the-business-case", theme: "performance" },
  { id: "removing-hiring-barriers", theme: "talent", image: "strategy-meeting" },
];

export function BusinessCase() {
  return (
    <section className="st-wrap st-business-case" aria-labelledby="business-case-heading">
      <div className="st-business-case-heading" data-enter>
        <div className="st-business-case-intro">
          <p>For Michigan students interested in business, accessibility is part of learning how to understand customers, evaluate a company, and manage a team. These studies show why it belongs in the decisions you practice in class and will make at work.</p>
          <Button to="/consulting/insights">Read the research</Button>
        </div>
        <h2 id="business-case-heading">Why accessibility belongs<br />in your business education.</h2>
      </div>
      <div className="st-evidence-grid">
        {CARDS.map(({ id, theme, image }) => {
          const item = RESEARCH.find((research) => research.id === id)!;
          return (
            <a className={`st-evidence-card st-evidence-card--${theme}`} href={item.url} key={id} data-enter>
              {image && (
                <img
                  className="st-evidence-photo"
                  src={`/consulting/${image}-960.jpg`}
                  srcSet={`/consulting/${image}-960.jpg 960w, /consulting/${image}-2400.jpg 2400w`}
                  sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1024px) 50vw, 65vw"
                  width={2400}
                  height={1600}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              )}
              <div>
                <h3 className="st-evidence-topic">{item.topic}</h3>
                <span className="st-evidence-value">{item.value}</span>
              </div>
              <div className="st-evidence-copy">
                <p className="st-evidence-metric">{item.metricLabel}.</p>
                <p className="st-evidence-relevance">{item.studentRelevance}</p>
                <span className="st-evidence-source">
                  <span>{item.source}<br />{item.date}</span>
                  <ArrowUpRight size={24} aria-hidden="true" />
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
