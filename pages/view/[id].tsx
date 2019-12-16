import { useEffect, useState, useRef } from "react";
import moment from "moment";
import * as d3 from "d3";
import { WordTokenizer, PorterStemmer } from "natural";
import { useRouter } from "next/router";
import { createDeflateRaw } from "zlib";

const tokenizer = new WordTokenizer();

const STEP = 10;

const commonWords = require("../../etc/words").map(PorterStemmer.stem);

const drag = simulation =>
  d3
    .drag()
    .on("start", d => {
      if (!d3.event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", d => {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    })
    .on("end", d => {
      if (!d3.event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });

export default () => {
  const router = useRouter();
  const { id } = router.query;
  const [transcript, setTranscript] = useState();
  const [player, setPlayer] = useState();
  const [time, setTime] = useState(0);
  const playerRef = useRef(null);
  const svgRef = useRef(null);
  const [{ nodes, links }, setData] = useState({ nodes: [], links: [] });
  const [{ simulation, node, link }, setD3Thing] = useState({
    simulation: null,
    node: null,
    link: null
  });

  useEffect(() => {
    if (!id) {
      return;
    }
    fetch(`/api/transcript/${id}`)
      .then(res => res.json())
      .then(transcript => setTranscript(transcript));

    (window as any).onYouTubeIframeAPIReady = () => {
      const YT = (window as any).YT;
      const player = new YT.Player("player", {
        height: "300",
        width: "400",
        videoId: id,
        events: {
          onReady: () => setPlayer(player),
          onStateChange: () => {
            console.log("new state");
          }
        }
      });
    };
    const tag = document.createElement("script");
    tag.src = "http://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  }, [id]);

  useEffect(() => {
    if (!player) {
      return;
    }
    const handler = setInterval(() => {
      if (player) {
        setTime(player.getCurrentTime());
      }
    }, 1000);

    return () => clearInterval(handler);
  }, [player]);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }
    const svg = d3.select(svgRef.current);
    const simulation = d3
      .forceSimulation([])
      .force(
        "link",
        d3
          .forceLink([])
          .id(d => d.id)
          .strength(link => {
            if (link.source.group === link.target.group) {
              if (link.target.group === 1) {
                return 2;
              } else {
                return 1 / 100;
              }
            }
            return (link.source.value || link.target.value) / 200;
          })
      )
      .force(
        "charge",
        d3.forceManyBody().strength(d => (d.group === 2 ? -20 : -80))
      )
      .force(
        "center",
        d3.forceCenter(
          svgRef.current.clientWidth / 2,
          svgRef.current.clientHeight / 2
        )
      )
      .on("tick", () => {
        link
          .attr("x1", d => d.source.x)
          .attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x)
          .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x},${d.y})`);
      });

    let link = svg
      .append("g")
      .attr("stroke-opacity", 0.6)
      .selectAll("line");

    let node = svg
      .append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("g");

    setD3Thing({ simulation, node, link });
  }, [svgRef.current]);

  useEffect(() => {
    if (!transcript) {
      return;
    }

    let filteredTranscript = time
      ? transcript.filter(
          part => moment.duration(part.begin).asSeconds() <= time
        )
      : transcript;

    const words = {};
    const occurrences = {};
    const nodes = [];
    const links = [];
    for (let i = 0; i < nodes.length - 1; i++) {}
    let count = 0;

    for (let i = 0; i < filteredTranscript.length; i += STEP) {
      const text = filteredTranscript
        .slice(i, i + STEP)
        .map(part => part.text)
        .join(" ");
      nodes.push({
        id: count,
        group: 1,
        title: text
      });
      if (i < filteredTranscript.length - STEP) {
        links.push({
          source: count,
          target: count + 1,
          width: 3,
          color: "black"
        });
      }

      const tokenized = tokenizer.tokenize(text);
      for (const word of tokenized) {
        const stemmed = PorterStemmer.stem(word);
        words[stemmed] = (words[stemmed] || 0) + 1;
        if (!occurrences[stemmed]) {
          occurrences[stemmed] = {};
        }
        occurrences[stemmed][word] = occurrences[stemmed][word] || 0 + 1;
      }
      count++;
    }
    if (filteredTranscript.length) {
      nodes.push({
        id: "start",
        group: 1,
        title: "Start",
        value: 10,
        color: "green"
      });
      nodes.push({
        id: "end",
        group: 1,
        title: "End",
        value: 10,
        color: "red"
      });
      links.push({ source: "start", target: 0, width: 3, color: "black" });
      links.push({
        source: count - 1,
        target: "end",
        width: 3,
        color: "black"
      });
    }

    const uncommonWords = Object.keys(words).filter(
      word => !commonWords.includes(word) && word.length > 4
    );
    const frequentWords = uncommonWords.filter(word => words[word] > 6);

    for (const word of frequentWords) {
      const maxOccurrence = Math.max(
        ...Object.values<number>(occurrences[word])
      );
      const occurrenceIndex = Object.values(occurrences[word]).indexOf(
        maxOccurrence
      );
      const title = Object.keys(occurrences[word])[occurrenceIndex];
      nodes.push({ id: word, group: 2, title, value: words[word] });
    }
    for (const node of nodes) {
      const tokenized = tokenizer
        .tokenize(node.title)
        .map(word => PorterStemmer.stem(word));
      for (const word of tokenized) {
        if (frequentWords.includes(word)) {
          links.push({
            source: node.id,
            target: word,
            color: "#999",
            width: 1
          });
        }
      }
    }
    setData({ nodes, links });
  }, [transcript, time]);

  useEffect(() => {
    if (!nodes || !links || !node || !link) {
      return;
    }
    const scale = d3.scaleOrdinal(d3.schemeCategory10);

    const newNode = node.data(nodes).join("g");
    newNode.exit().remove();
    newNode
      .enter()
      .append("circle")
      .attr("r", d => d.value || 5)
      .attr("fill", d => d.color || scale(d.group))
      .call(drag)
      .merge(newNode);

    /*
    node
      .filter(d => d.group === 2)
      .append("text")
      .attr("stroke", "black")
      .text(d => d.title)
      .attr("x", 6)
      .attr("y", 3);

    node
      .filter(d => d.group === 1)
      .append("title")
      .text(d => d.title);
      */

    const newLink = link.data(links);
    newLink.exit().remove();
    newLink
      .enter()
      .append("line")
      .attr("stroke", d => d.color)
      .attr("stroke-width", d => d.width)
      .merge(newLink);

    simulation.nodes(nodes);
    simulation.force("links", links);
    simulation.alpha(1).restart();

    setD3Thing({ node: newNode, link: newLink, simulation });
  }, [nodes, links]);

  return (
    <>
      <style>{`* { box-sizing: border-box } html, body, #__next { width: 100%; height: 100%; margin: 0; padding: 0; display: flex; flex-direction: column; }`}</style>
      <div style={{ display: "flex", flexDirection: "row", height: "100%" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            width: "500px",
            flex: "none"
          }}
        >
          <div id="player" ref={playerRef} />
          <div
            style={{
              height: "100%",
              overflowY: "auto",
              flex: "1 1 auto",
              padding: "1rem"
            }}
          >
            {transcript ? (
              transcript.map((part, i) => (
                <div
                  key={i}
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    player &&
                    player.seekTo(moment.duration(part.begin).asSeconds())
                  }
                >
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "70%",
                      color: "lightgray"
                    }}
                  >
                    {moment
                      .utc(moment.duration(part.begin).asMilliseconds())
                      .format("HH:mm:ss")}
                  </span>{" "}
                  <span>{part.text}</span>
                </div>
              ))
            ) : (
              <span>Loading transcript from youtube...</span>
            )}
          </div>
        </div>
        <div style={{ flex: "1 1 auto" }}>
          {transcript ? (
            <svg ref={svgRef} style={{ width: "100%", height: "100%" }}></svg>
          ) : (
            <span>Loading transcript from youtube...</span>
          )}
        </div>
      </div>
    </>
  );
};
