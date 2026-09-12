FROM docker:28-cli

RUN apk add --no-cache curl bash \
    && curl --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/nektos/act/master/install.sh | bash -s -- -b /usr/local/bin

COPY actrc /root/.config/act/actrc

ENTRYPOINT ["tail", "-f", "/dev/null"]
