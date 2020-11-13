/**
 *
 * Copyright 2020 Tencent
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

import { Plugin, PluginServiceApi } from '@cloudbase/framework-core';
import { plugin as FunctionPlugin } from '@cloudbase/framework-plugin-function';
import { NuxtBuilder } from '@cloudbase/nuxt-builder';

const DEFAULT_INPUTS = {
  memory: 128,
  timeout: 5,
  runtime: 'Nodejs10.15',
  entry: './',
  name: 'nuxt-ssr',
  path: '/nuxt-ssr',
  buildCommand: 'npm run build',
  installCommand: 'npm install',
};

/**
 * 导出接口用于生成 JSON Schema 来进行智能提示
 */
export interface IFrameworkPluginNuxtInputs {
  /**
   * Nuxt 配置文件所在目录，默认当前项目所在目录
   * @default ./
   */
  entry?: string;
  /**
   * 访问子路径，如 `/nuxt-ssr`
   * @default /nuxt-ssr
   */
  path?: string;
  /**
   * 服务名，如`nuxt-ssr`
   * @default nuxt-ssr
   */
  name?: string;
  /**
   * 安装命令，如`npm install`，没有可不传
   * @default npm install
   */
  installCommand?: string;
  /**
   * 构建命令，如`npm run build`，没有可不传
   * @default npm run build
   */
  buildCommand?: string;
  /**
   * 函数运行时版本
   * @default "Nodejs10.15"
   */
  runtime?: 'Nodejs10.15' | 'Nodejs8.9';
  /**
   * 函数运行时内存配置
   * @default 128
   */
  memory?: 128 | 256 | 512 | 1024 | 2048;
  /**
   * 函数超时时间（1 - 60S）
   */
  timeout?: number;
  /**
   * 包含环境变量的键值对
   */
  envVariables?: Record<string, string>;
}

type ResolvedInputs = typeof DEFAULT_INPUTS & IFrameworkPluginNuxtInputs;

class NuxtPlugin extends Plugin {
  protected resolvedInputs: ResolvedInputs;
  protected buildOutput: any;
  protected builder: NuxtBuilder;
  protected functionPlugin: any;

  constructor(
    public name: string,
    public api: PluginServiceApi,
    public inputs: IFrameworkPluginNuxtInputs
  ) {
    super(name, api, inputs);

    this.resolvedInputs = resolveInputs(this.inputs, DEFAULT_INPUTS);

    this.builder = new NuxtBuilder({
      projectPath: this.api.projectPath,
    });
  }

  /**
   * 初始化
   */
  async init() {
    this.api.logger.debug('NuxtPlugin: init', this.resolvedInputs);
    const { installCommand } = this.resolvedInputs;
    if (fs.existsSync('package.json')) {
      this.api.logger.info(installCommand);
      return promisify(exec)(installCommand);
    }
  }

  async compile() {
    this.api.logger.debug('NuxtPlugin: compile', this.resolvedInputs);

    return this.functionPlugin.compile();
  }

  /**
   * 执行本地命令
   */
  async run() {}

  /**
   * 删除资源
   */
  async remove() {}

  /**
   * 生成代码
   */
  async genCode() {}

  /**
   * 构建
   */
  async build() {
    this.api.logger.debug('NuxtPlugin: build', this.resolvedInputs);

    const { buildCommand } = this.resolvedInputs;

    if (buildCommand) {
      await promisify(exec)(buildCommand);
    }

    this.buildOutput = await this.builder.build(this.resolvedInputs.entry, {
      name: this.resolvedInputs.name,
      path: this.resolvedInputs.path,
    });

    const srcFunction = this.buildOutput.functions[0];

    this.functionPlugin = new FunctionPlugin('function', this.api, {
      functionRootPath: srcFunction.source,
      functions: [
        {
          name: srcFunction.name,
          handler: srcFunction.entry,
          runtime: this.resolvedInputs.runtime,
          installDependency: true,
          memory: this.resolvedInputs.memory,
          timeout: this.resolvedInputs.timeout,
          envVariables: this.resolvedInputs.envVariables,
        },
      ],
      servicePaths: {
        [this.resolvedInputs.name]: this.resolvedInputs.path,
      },
    });
  }

  /**
   * 部署
   */
  async deploy() {
    this.api.logger.debug(
      'NuxtPlugin: deploy',
      this.resolvedInputs,
      this.buildOutput
    );

    await this.functionPlugin.deploy();

    await this.builder.clean();

    this.api.logger.info('🚀 Nuxt 应用部署成功');
  }
}

function resolveInputs(inputs: any, defaultInputs: any) {
  return Object.assign({}, defaultInputs, inputs);
}

export const plugin = NuxtPlugin;
