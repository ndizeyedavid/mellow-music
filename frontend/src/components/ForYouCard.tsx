import type { ForYouCardData } from "../data/library";
import { Icon } from "./Icon";

/** Large "For You" hero card: image, blurred footer, caption, title, play CTA. */
export function ForYouCard({
  image,
  caption,
  captionColor,
  title,
  description,
}: ForYouCardData) {
  return (
    <article className="relative h-[375px] w-[255px] shrink-0 overflow-hidden rounded-lg shadow-xl-dark">
      <img
        src={image}
        alt=""
        className="h-[257px] w-full object-cover"
        loading="lazy"
      />

      <div className="absolute inset-x-0 bottom-0 h-[118px] overflow-hidden">
        <img
          src={image}
          alt=""
          aria-hidden
          className="absolute -left-1.5 -top-[77px] h-[266px] w-[266px] object-cover opacity-40 blur-[36px]"
          loading="lazy"
        />
        <div className="absolute inset-x-[14px] top-4 flex flex-col">
          <span
            className={`text-[10px]/[12px] font-semibold uppercase ${
              captionColor === "accent" ? "text-accent" : "text-danger"
            }`}
          >
            {caption}
          </span>
          <h3 className="mt-2 text-[18px]/[24px] font-semibold text-fg">
            {title}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-[14px]/[20px] font-semibold text-subtle">
            {description}
          </p>
        </div>
      </div>

      <button
        type="button"
        aria-label={`Play ${title}`}
        className="absolute bottom-[98px] right-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-fg text-[#171719] shadow-md-dark transition-transform hover:scale-105"
      >
        <Icon name="play" size={24} />
      </button>
    </article>
  );
}
